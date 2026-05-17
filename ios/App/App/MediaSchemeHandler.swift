import Foundation
import WebKit
import Security

class MediaSchemeHandler: NSObject, WKURLSchemeHandler {
    private let session: URLSession

    override init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 600
        self.session = URLSession(configuration: config)
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            urlSchemeTask.didFailWithError(SchemeError.invalidURL)
            return
        }

        guard let credentials = readCredentials() else {
            urlSchemeTask.didFailWithError(SchemeError.noCredentials)
            return
        }

        let endpoint = components.host ?? components.path
        var queryItems = components.queryItems ?? []

        let authParams = buildAuthParams(credentials: credentials)
        for (key, value) in authParams {
            queryItems.append(URLQueryItem(name: key, value: value))
        }

        let cleanEndpoint = endpoint.hasPrefix("/") ? String(endpoint.dropFirst()) : endpoint
        let serverUrlString = "\(credentials.serverUrl)/rest/\(cleanEndpoint)"

        guard var realComponents = URLComponents(string: serverUrlString) else {
            urlSchemeTask.didFailWithError(SchemeError.invalidURL)
            return
        }

        realComponents.queryItems = queryItems

        guard let realURL = realComponents.url else {
            urlSchemeTask.didFailWithError(SchemeError.invalidURL)
            return
        }

        let task = session.dataTask(with: realURL) { [weak self] data, response, error in
            guard self != nil else { return }

            if let error = error {
                urlSchemeTask.didFailWithError(error)
                return
            }

            guard let httpResponse = response as? HTTPURLResponse,
                  let data = data else {
                urlSchemeTask.didFailWithError(SchemeError.invalidResponse)
                return
            }

            let headers: [String: String] = [
                "Content-Type": httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream",
                "Content-Length": "\(data.count)",
                "Cache-Control": httpResponse.value(forHTTPHeaderField: "Cache-Control") ?? "max-age=3600",
            ]

            let schemeResponse = HTTPURLResponse(
                url: url,
                statusCode: httpResponse.statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: headers
            )!

            urlSchemeTask.didReceive(schemeResponse)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }

        task.resume()
        objc_setAssociatedObject(urlSchemeTask, &AssociatedKeys.dataTask, task, .OBJC_ASSOCIATION_RETAIN)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        if let task = objc_getAssociatedObject(urlSchemeTask, &AssociatedKeys.dataTask) as? URLSessionDataTask {
            task.cancel()
        }
    }

    // MARK: - Keychain Access

    private struct Credentials {
        let serverUrl: String
        let username: String
        let password: String
        let authType: String
        let protocolVersion: String
    }

    private func readCredentials() -> Credentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "github.realtvop.aonsoku.credentials",
            kSecAttrAccount as String: "server-credentials",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }

        guard let serverUrl = json["serverUrl"] as? String,
              let username = json["username"] as? String,
              let password = json["password"] as? String,
              let authType = json["authType"] as? String,
              let protocolVersion = json["protocolVersion"] as? String else { return nil }

        return Credentials(
            serverUrl: serverUrl,
            username: username,
            password: password,
            authType: authType,
            protocolVersion: protocolVersion
        )
    }

    private func buildAuthParams(credentials: Credentials) -> [String: String] {
        var params: [String: String] = [
            "u": credentials.username,
            "v": credentials.protocolVersion,
            "c": "Aonsoku",
            "f": "json",
        ]

        if credentials.authType == "token" {
            params["t"] = credentials.password
            params["s"] = "40n50kuPl4y3r"
        } else {
            params["p"] = credentials.password
        }

        return params
    }
}

private struct AssociatedKeys {
    static var dataTask = "mediaSchemeDataTask"
}

private enum SchemeError: Error {
    case invalidURL
    case noCredentials
    case invalidResponse
}
