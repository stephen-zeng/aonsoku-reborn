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
    private let syncQueue = DispatchQueue(label: "com.aonsoku.MediaSchemeHandler.sync")

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let taskState = MediaSchemeTaskState(
            schemeTask: urlSchemeTask,
            originalURL: urlSchemeTask.request.url ?? URL(string: "about:blank")!
        )

        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            taskState.didFail(with: SchemeError.invalidURL)
            return
        }

        guard let credentials = MediaKeychainHelper.retrieve() else {
            taskState.didFail(with: SchemeError.noCredentials)
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
            taskState.didFail(with: SchemeError.invalidURL)
            return
        }

        realComponents.queryItems = queryItems

        guard let realURL = realComponents.url else {
            taskState.didFail(with: SchemeError.invalidURL)
            return
        }

        taskState.originalURL = url
        let dataTask = session.dataTask(with: realURL)
        syncQueue.sync {
            activeTasks[dataTask.taskIdentifier] = taskState
            urlSessionTasks[dataTask.taskIdentifier] = dataTask
        }
        dataTask.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        let dataTask: URLSessionDataTask? = syncQueue.sync {
            let taskId = activeTasks.first {
                $0.value.schemeTask === urlSchemeTask
            }?.key
            let schemeTaskState = taskId.flatMap { activeTasks[$0] }
            schemeTaskState?.stop()
            let task = taskId.flatMap { urlSessionTasks.removeValue(forKey: $0) }
            if let taskId {
                activeTasks.removeValue(forKey: taskId)
            }
            return task
        }

        dataTask?.cancel()
    }

    // MARK: - URLSessionDataDelegate

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        let schemeTaskState: MediaSchemeTaskState? = syncQueue.sync {
            activeTasks[dataTask.taskIdentifier]
        }

        guard let schemeTaskState else {
            completionHandler(.cancel)
            return
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            return
        }

        var headers: [String: String] = [
            "Content-Type": httpResponse.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream",
            "Cache-Control": httpResponse.value(forHTTPHeaderField: "Cache-Control") ?? "max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
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
        let schemeTaskState: MediaSchemeTaskState? = syncQueue.sync {
            activeTasks[dataTask.taskIdentifier]
        }
        schemeTaskState?.didReceive(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let schemeTaskState: MediaSchemeTaskState? = syncQueue.sync {
            urlSessionTasks.removeValue(forKey: task.taskIdentifier)
            return activeTasks[task.taskIdentifier]
        }

        guard let schemeTaskState else { return }

        var didComplete = false
        if let error, (error as NSError).code != NSURLErrorCancelled {
            didComplete = schemeTaskState.didFail(with: error)
        } else if error == nil {
            didComplete = schemeTaskState.didFinish()
        }

        if didComplete {
            syncQueue.sync {
                if activeTasks[task.taskIdentifier] === schemeTaskState {
                    activeTasks.removeValue(forKey: task.taskIdentifier)
                }
            }
        }
    }
}

private final class MediaSchemeTaskState {
    let schemeTask: WKURLSchemeTask
    var originalURL: URL

    private let syncQueue = DispatchQueue(label: "com.aonsoku.MediaSchemeTaskState.sync")
    private var isStopped = false
    private var isCompleted = false

    init(schemeTask: WKURLSchemeTask, originalURL: URL) {
        self.schemeTask = schemeTask
        self.originalURL = originalURL
    }

    func stop() {
        syncQueue.sync { isStopped = true }
    }

    private var isInvalid: Bool {
        isStopped || isCompleted
    }

    private func safePerform(_ block: @escaping () -> Void) {
        DispatchQueue.main.async { [self] in
            let stopped = syncQueue.sync { isStopped }
            guard !stopped else { return }
            try? ObjCExceptionCatcher.perform { block() }
        }
    }

    @discardableResult
    func didReceive(_ response: URLResponse) -> Bool {
        let invalid = syncQueue.sync { isInvalid }
        guard !invalid else { return false }

        let task = schemeTask
        safePerform { task.didReceive(response) }
        return true
    }

    func didReceive(_ data: Data) {
        let invalid = syncQueue.sync { isInvalid }
        guard !invalid else { return }

        let task = schemeTask
        safePerform { task.didReceive(data) }
    }

    @discardableResult
    func didFinish() -> Bool {
        let invalid: Bool = syncQueue.sync {
            guard !isInvalid else { return true }
            isCompleted = true
            return false
        }
        guard !invalid else { return false }

        let task = schemeTask
        safePerform { task.didFinish() }
        return true
    }

    @discardableResult
    func didFail(with error: Error) -> Bool {
        let invalid: Bool = syncQueue.sync {
            guard !isInvalid else { return true }
            isCompleted = true
            return false
        }
        guard !invalid else { return false }

        let task = schemeTask
        let nsError = error as NSError
        safePerform { task.didFailWithError(nsError) }
        return true
    }
}

private enum SchemeError: Error {
    case invalidURL
    case noCredentials
}
