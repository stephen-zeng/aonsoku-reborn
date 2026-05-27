import Foundation
import GRDB

final class ImageCacheManager {
    private let db: DatabasePool
    private let session: URLSession

    init(db: DatabasePool) {
        self.db = db
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
    }

    // MARK: - Public API

    func downloadCoverImage(coverArtId: String, size: String) async throws -> URL {
        guard let credentials = KeychainManager.retrieve() else {
            throw ImageCacheError.noCredentials
        }

        let directory = try ImageCacheUtils.cacheDirectoryURL(createIfNeeded: true)
        let fileName = "\(ImageCacheUtils.cacheId(for: coverArtId)).jpg"
        let fileURL = directory.appendingPathComponent(fileName, isDirectory: false)

        // Remove existing file before downloading
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try? FileManager.default.removeItem(at: fileURL)
        }

        let url = try buildCoverArtURL(credentials: credentials, coverArtId: coverArtId, size: size)
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode >= 200, httpResponse.statusCode < 300 else {
            throw ImageCacheError.downloadFailed(NSError(domain: "ImageCache", code: -1))
        }

        let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "image/jpeg"
        let ext = ImageCacheUtils.fileExtension(for: contentType)
        let finalFileName = "\(ImageCacheUtils.cacheId(for: coverArtId)).\(ext)"
        let finalFileURL = directory.appendingPathComponent(finalFileName, isDirectory: false)

        if finalFileURL.path != fileURL.path {
            try? FileManager.default.removeItem(at: finalFileURL)
        }

        try data.write(to: finalFileURL, options: [.atomic])

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let record = CacheMetaRecord(
            key: "cover:\(coverArtId)",
            id: coverArtId,
            type: "cover",
            source: "explicit",
            triggersJson: nil,
            coverSize: size,
            sizeBytes: data.count,
            cachedAt: now,
            lastAccessedAt: now,
            removedFromServer: nil
        )

        let repo = CacheMetaRepository(db: db)
        try repo.upsert(record)

        return finalFileURL
    }

    func storeCoverImage(coverArtId: String, data: Data, contentType: String, coverSize: String) throws -> URL {
        let directory = try ImageCacheUtils.cacheDirectoryURL(createIfNeeded: true)
        let ext = ImageCacheUtils.fileExtension(for: contentType)
        let fileName = "\(ImageCacheUtils.cacheId(for: coverArtId)).\(ext)"
        let fileURL = directory.appendingPathComponent(fileName, isDirectory: false)

        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
        }

        try data.write(to: fileURL, options: [.atomic])

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let record = CacheMetaRecord(
            key: "cover:\(coverArtId)",
            id: coverArtId,
            type: "cover",
            source: "explicit",
            triggersJson: nil,
            coverSize: coverSize,
            sizeBytes: data.count,
            cachedAt: now,
            lastAccessedAt: now,
            removedFromServer: nil
        )

        let repo = CacheMetaRepository(db: db)
        try repo.upsert(record)

        return fileURL
    }

    func resolveCoverImage(coverArtId: String) -> URL? {
        guard let directory = try? ImageCacheUtils.cacheDirectoryURL(createIfNeeded: false) else {
            return nil
        }

        let cacheId = ImageCacheUtils.cacheId(for: coverArtId)
        guard let fileURL = try? findCoverImageURL(cacheId: cacheId, in: directory) else {
            return nil
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }

        // Update lastAccessedAt asynchronously (best effort)
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            let key = "cover:\(coverArtId)"
            let now = Int(Date().timeIntervalSince1970 * 1000)
            try? self.db.write { db in
                try CacheMetaRecord
                    .filter(Column("key") == key)
                    .updateAll(db, Column("lastAccessedAt").set(to: now))
            }
        }

        return fileURL
    }

    func deleteCoverImage(coverArtId: String) throws -> Bool {
        let directory = try ImageCacheUtils.cacheDirectoryURL(createIfNeeded: false)
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return false
        }

        let cacheId = ImageCacheUtils.cacheId(for: coverArtId)
        let urls = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )

        var deleted = false
        for url in urls where url.lastPathComponent.hasPrefix("\(cacheId).") {
            try FileManager.default.removeItem(at: url)
            deleted = true
        }

        let key = "cover:\(coverArtId)"
        let repo = CacheMetaRepository(db: db)
        try repo.delete(key: key)

        return deleted
    }

    func clearCoverImages() throws -> Int {
        let directory = try ImageCacheUtils.cacheDirectoryURL(createIfNeeded: false)
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return 0
        }

        let urls = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )

        var deletedCount = 0
        for url in urls {
            try FileManager.default.removeItem(at: url)
            deletedCount += 1
        }

        try db.write { db in
            try CacheMetaRecord
                .filter(Column("type") == "cover")
                .deleteAll(db)
        }

        return deletedCount
    }

    func getCoverImageSize(coverArtId: String) -> (sizeBytes: Int, coverSize: String?)? {
        guard let directory = try? ImageCacheUtils.cacheDirectoryURL(createIfNeeded: false),
              let fileURL = try? findCoverImageURL(
                  cacheId: ImageCacheUtils.cacheId(for: coverArtId),
                  in: directory
              ),
              FileManager.default.fileExists(atPath: fileURL.path),
              let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
              let size = attrs[.size] as? NSNumber else {
            return nil
        }

        let key = "cover:\(coverArtId)"
        let record = try? CacheMetaRepository(db: db).getByKey(key)

        return (sizeBytes: size.intValue, coverSize: record?.coverSize)
    }

    // MARK: - Private Helpers

    private func buildCoverArtURL(credentials: ServerCredentials, coverArtId: String, size: String) throws -> URL {
        var params = SubsonicAuthBuilder.buildQueryParams(
            username: credentials.username,
            password: credentials.password,
            authType: credentials.authType,
            protocolVersion: credentials.protocolVersion
        )
        params["id"] = coverArtId
        params["size"] = size

        let baseString = "\(credentials.serverUrl)/rest/getCoverArt"
        guard var components = URLComponents(string: baseString) else {
            throw ImageCacheError.invalidURL
        }
        components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }

        guard let url = components.url else {
            throw ImageCacheError.invalidURL
        }
        return url
    }

    private func findCoverImageURL(cacheId: String, in directory: URL) throws -> URL? {
        let urls = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        return urls.first { $0.lastPathComponent.hasPrefix("\(cacheId).") }
    }
}
