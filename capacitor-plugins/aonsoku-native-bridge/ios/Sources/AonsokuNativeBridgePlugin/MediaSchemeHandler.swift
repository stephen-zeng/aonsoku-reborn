import Foundation
import WebKit

public class MediaSchemeHandler: NSObject, WKURLSchemeHandler {
    private let session: URLSession

    public override init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 600
        self.session = URLSession(configuration: config)
        super.init()
    }

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            urlSchemeTask.didFailWithError(SchemeError.invalidURL)
            return
        }

        guard let credentials = KeychainManager.retrieve() else {
            urlSchemeTask.didFailWithError(SchemeError.noCredentials)
            return
        }

        let endpoint = components.host ?? components.path
        var queryItems = components.queryItems ?? []

        let authParams = SubsonicAuthBuilder.buildQueryParams(
            username: credentials.username,
            password: credentials.password,
            authType: credentials.authType,
            protocolVersion: credentials.protocolVersion
        )

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

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        if let task = objc_getAssociatedObject(urlSchemeTask, &AssociatedKeys.dataTask) as? URLSessionDataTask {
            task.cancel()
        }
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
