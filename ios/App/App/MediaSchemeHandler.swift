import Foundation
import WebKit

class MediaSchemeHandler: NSObject, WKURLSchemeHandler, URLSessionDataDelegate {
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 600
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private var activeTasks: [Int: MediaSchemeTaskState] = [:]
    private var urlSessionTasks: [Int: URLSessionDataTask] = [:]
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
        activeTasks[dataTask.taskIdentifier] = MediaSchemeTaskState(
            schemeTask: urlSchemeTask,
            originalURL: url
        )
        urlSessionTasks[dataTask.taskIdentifier] = dataTask
        lock.unlock()
        dataTask.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        let taskId = activeTasks.first {
            $0.value.schemeTask === urlSchemeTask
        }?.key
        let schemeTaskState = taskId.flatMap {
            activeTasks[$0]
        }
        schemeTaskState?.stop()
        let dataTask = taskId.flatMap { urlSessionTasks.removeValue(forKey: $0) }
        if let taskId {
            activeTasks.removeValue(forKey: taskId)
        }
        lock.unlock()

        dataTask?.cancel()
    }

    // MARK: - URLSessionDataDelegate

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        lock.lock()
        guard let schemeTaskState = activeTasks[dataTask.taskIdentifier] else {
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
            url: schemeTaskState.originalURL,
            statusCode: httpResponse.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )!

        if schemeTaskState.didReceive(schemeResponse) {
            completionHandler(.allow)
        } else {
            completionHandler(.cancel)
        }
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock()
        guard let schemeTaskState = activeTasks[dataTask.taskIdentifier] else {
            lock.unlock()
            return
        }
        lock.unlock()
        schemeTaskState.didReceive(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let schemeTaskState = activeTasks[task.taskIdentifier]
        urlSessionTasks.removeValue(forKey: task.taskIdentifier)
        lock.unlock()

        guard let schemeTaskState else { return }

        var didComplete = false
        if let error, (error as NSError).code != NSURLErrorCancelled {
            didComplete = schemeTaskState.didFail(with: error)
        } else if error == nil {
            didComplete = schemeTaskState.didFinish()
        }

        if didComplete {
            lock.lock()
            if activeTasks[task.taskIdentifier] === schemeTaskState {
                activeTasks.removeValue(forKey: task.taskIdentifier)
            }
            lock.unlock()
        }
    }
}

private final class MediaSchemeTaskState {
    let schemeTask: WKURLSchemeTask
    let originalURL: URL

    private let lock = NSLock()
    private var isStopped = false
    private var isCompleted = false

    init(schemeTask: WKURLSchemeTask, originalURL: URL) {
        self.schemeTask = schemeTask
        self.originalURL = originalURL
    }

    func stop() {
        lock.lock()
        isStopped = true
        lock.unlock()
    }

    @discardableResult
    func didReceive(_ response: URLResponse) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard !isStopped, !isCompleted else { return false }

        schemeTask.didReceive(response)
        return true
    }

    func didReceive(_ data: Data) {
        lock.lock()
        defer { lock.unlock() }

        guard !isStopped, !isCompleted else { return }

        schemeTask.didReceive(data)
    }

    @discardableResult
    func didFinish() -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard !isStopped, !isCompleted else { return false }

        isCompleted = true
        schemeTask.didFinish()
        return true
    }

    @discardableResult
    func didFail(with error: Error) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard !isStopped, !isCompleted else { return false }

        isCompleted = true
        schemeTask.didFailWithError(error)
        return true
    }
}

private enum SchemeError: Error {
    case invalidURL
    case noCredentials
}
