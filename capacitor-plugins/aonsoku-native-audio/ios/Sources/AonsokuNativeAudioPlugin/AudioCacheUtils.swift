import Foundation

enum AudioCacheUtils {
    static let appSupportSubdirectory = "Aonsoku"
    static let cacheDirectoryName = "AudioCache"

    static func cacheId(for songId: String) -> String {
        Data(songId.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
