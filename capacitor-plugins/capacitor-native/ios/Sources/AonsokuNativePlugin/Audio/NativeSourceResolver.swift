import Foundation

class NativeSourceResolver {
    private let cacheDirectory: URL

    init() {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        ).first!
        self.cacheDirectory = appSupport
            .appendingPathComponent("Aonsoku", isDirectory: true)
            .appendingPathComponent("AudioCache", isDirectory: true)
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

        if let url = buildAuthenticatedStreamUrl(songId: song.id) {
            return (url, "stream")
        }

        guard let streamUrl = URL(string: song.streamUrl) else {
            return nil
        }
        return (streamUrl, "stream")
    }

    private func buildAuthenticatedStreamUrl(songId: String) -> URL? {
        guard let credentials = KeychainManager.retrieve() else { return nil }

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
