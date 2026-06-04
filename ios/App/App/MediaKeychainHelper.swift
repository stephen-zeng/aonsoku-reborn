import Foundation
import Security

struct MediaCredentials {
    let serverUrl: String
    let username: String
    let password: String
    let authType: String
    let protocolVersion: String
}

enum MediaKeychainHelper {
    private static let service = "github.realtvop.aonsoku.credentials"
    private static let account = "server-credentials"
    private static let salt = "40n50kuPl4y3r"
    private static let clientName = "Aonsoku"

    static func retrieve() -> MediaCredentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let json = try? JSONDecoder().decode(DecodedCredentials.self, from: data) else {
            return nil
        }

        return MediaCredentials(
            serverUrl: json.serverUrl,
            username: json.username,
            password: json.password,
            authType: json.authType,
            protocolVersion: json.protocolVersion
        )
    }

    static func buildAuthParams(credentials: MediaCredentials) -> [String: String] {
        var params: [String: String] = [
            "u": credentials.username,
            "v": credentials.protocolVersion,
            "c": clientName,
            "f": "json",
        ]

        if credentials.authType == "token" {
            params["t"] = credentials.password
            params["s"] = salt
        } else {
            params["p"] = credentials.password
        }

        return params
    }
}

private struct DecodedCredentials: Decodable {
    let serverUrl: String
    let username: String
    let password: String
    let authType: String
    let protocolVersion: String
}
