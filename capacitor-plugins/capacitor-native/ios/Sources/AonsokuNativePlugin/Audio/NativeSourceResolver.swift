import Foundation

class NativeSourceResolver {
    private let cacheDirectory: URL
    private var cachedCredentials: ServerCredentials?
    private var credentialsCacheTime: Date?
    private let credentialsTTL: TimeInterval = 30

    init() {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        ).first!
        self.cacheDirectory = appSupport
            .appendingPathComponent("Aonsoku", isDirectory: true)
            .appendingPathComponent("AudioCache", isDirectory: true)
    }

    private func getCredentials() -> ServerCredentials? {
        if let cached = cachedCredentials,
           let cacheTime = credentialsCacheTime,
           Date().timeIntervalSince(cacheTime) < credentialsTTL {
            return cached
        }
        let creds = KeychainManager.retrieve()
        cachedCredentials = creds
        credentialsCacheTime = Date()
        return creds
    }

    func resolveSource(for song: QueueSong) -> (url: URL, kind: String)? {
        if let cachedUri = song.cachedFileUri, !cachedUri.isEmpty {
            let fileUrl = URL(fileURLWithPath: cachedUri)
            if FileManager.default.fileExists(atPath: fileUrl.path) {
                return (fileUrl, "native-file")
            }
        }

        let cacheId = cacheId(for: song.id)
        let extensions = ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav"]
        for ext in extensions {
            let fileUrl = cacheDirectory.appendingPathComponent("\(cacheId).\(ext)")
            if FileManager.default.fileExists(atPath: fileUrl.path) {
                return (fileUrl, "native-file")
            }
        }

        // Extract songId from aonsoku-media://stream?id=... URLs if present
        let effectiveSongId: String
        if song.streamUrl.hasPrefix("aonsoku-media://stream"),
           let components = URLComponents(string: song.streamUrl),
           let queryItems = components.queryItems,
           let idItem = queryItems.first(where: { $0.name == "id" }),
           let idValue = idItem.value, !idValue.isEmpty {
            effectiveSongId = idValue
        } else {
            effectiveSongId = song.id
        }

        if let url = buildAuthenticatedStreamUrl(songId: effectiveSongId) {
            return (url, "stream")
        }

        // Fallback: if streamUrl itself is a valid absolute URL, try to use it directly
        if let streamUrl = URL(string: song.streamUrl),
           streamUrl.scheme != nil,
           streamUrl.host != nil {
            return (streamUrl, "stream")
        }

        return nil
    }

    private func buildAuthenticatedStreamUrl(songId: String) -> URL? {
        guard let credentials = getCredentials() else { return nil }

        var params = SubsonicAuthBuilder.buildQueryParams(
            username: credentials.username,
            password: credentials.password,
            authType: credentials.authType,
            protocolVersion: credentials.protocolVersion
        )
        params["id"] = songId
        params["estimateContentLength"] = "false"

        let baseString = "\(credentials.serverUrl)/rest/stream"
        guard var components = URLComponents(string: baseString) else { return nil }
        components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components.url
    }

    private func cacheId(for songId: String) -> String {
        AudioCacheUtils.cacheId(for: songId)
    }
}
