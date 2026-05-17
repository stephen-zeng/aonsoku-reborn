import Foundation
import WebKit

class MediaSchemeHandler: NSObject, WKURLSchemeHandler, URLSessionDataDelegate {
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 600
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private var activeTasks: [Int: WKURLSchemeTask] = [:]
    private var originalURLs: [Int: URL] = [:]
    private let lock = NSLock()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            urlSchemeTask.didFailWithError(SchemeError.invalidURL)
            return
        }

        guard let credentials = MediaKeychainHelper.retrieve() else {
            urlSchemeTask.didFailWithError(SchemeError.noCredentials)
            return
        }

        let endpoint = components.host ?? components.path
        var queryItems = components.queryItems ?? []

        let authParams = MediaKeychainHelper.buildAuthParams(credentials: credentials)
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

        let dataTask = session.dataTask(with: realURL)
        lock.lock()
        activeTasks[dataTask.taskIdentifier] = urlSchemeTask
        originalURLs[dataTask.taskIdentifier] = url
        lock.unlock()
        dataTask.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        let taskId = activeTasks.first(where: { $0.value === urlSchemeTask })?.key
        lock.unlock()

        guard let taskId else { return }
        session.getAllTasks { tasks in
            tasks.first(where: { $0.taskIdentifier == taskId })?.cancel()
        }
    }

    // MARK: - URLSessionDataDelegate

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        lock.lock()
        guard let schemeTask = activeTasks[dataTask.taskIdentifier],
              let originalURL = originalURLs[dataTask.taskIdentifier] else {
            lock.unlock()
            completionHandler(.cancel)
            return
        }
        lock.unlock()

        guard let httpResponse = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            return
        }

        var headers: [String: String] = [
            "Content-Type": httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream",
            "Cache-Control": httpResponse.value(forHTTPHeaderField: "Cache-Control") ?? "max-age=3600",
        ]
        if let contentLength = httpResponse.value(forHTTPHeaderField: "Content-Length") {
            headers["Content-Length"] = contentLength
        }

        let schemeResponse = HTTPURLResponse(
            url: originalURL,
            statusCode: httpResponse.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )!

        schemeTask.didReceive(schemeResponse)
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock()
        guard let schemeTask = activeTasks[dataTask.taskIdentifier] else {
            lock.unlock()
            return
        }
        lock.unlock()
        schemeTask.didReceive(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let schemeTask = activeTasks.removeValue(forKey: task.taskIdentifier)
        originalURLs.removeValue(forKey: task.taskIdentifier)
        lock.unlock()

        guard let schemeTask else { return }

        if let error, (error as NSError).code != NSURLErrorCancelled {
            schemeTask.didFailWithError(error)
        } else if error == nil {
            schemeTask.didFinish()
        }
    }
}

private enum SchemeError: Error {
    case invalidURL
    case noCredentials
}
