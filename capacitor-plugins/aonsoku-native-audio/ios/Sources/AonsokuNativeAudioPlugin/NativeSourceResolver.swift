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

        let hashedName = hashSongId(song.id)
        let extensions = ["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav"]
        for ext in extensions {
            let fileUrl = cacheDirectory.appendingPathComponent("\(hashedName).\(ext)")
            if FileManager.default.fileExists(atPath: fileUrl.path) {
                return (fileUrl, "native-file")
            }
        }

        guard let streamUrl = URL(string: song.streamUrl) else {
            return nil
        }
        return (streamUrl, "stream")
    }

    private func hashSongId(_ songId: String) -> String {
        var hash: UInt64 = 5381
        for byte in songId.utf8 {
            hash = ((hash &<< 5) &+ hash) &+ UInt64(byte)
        }
        return String(hash, radix: 16)
    }
}
