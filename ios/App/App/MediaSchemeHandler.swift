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
    private let syncQueue = DispatchQueue(
        label: "com.aonsoku.MediaSchemeHandler.sync",
        attributes: .concurrent
    )
    private let workQueue = DispatchQueue(
        label: "com.aonsoku.MediaSchemeHandler.work",
        qos: .userInitiated
    )

    private var cachedCredentials: MediaCredentials?
    private var credentialsCacheTime: Date?
    private let credentialsTTL: TimeInterval = 60

    private func getCredentials() -> MediaCredentials? {
        if let cached = cachedCredentials,
           let cacheTime = credentialsCacheTime,
           Date().timeIntervalSince(cacheTime) < credentialsTTL {
            return cached
        }
        let creds = MediaKeychainHelper.retrieve()
        cachedCredentials = creds
        credentialsCacheTime = Date()
        return creds
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let taskState = MediaSchemeTaskState(
            schemeTask: urlSchemeTask,
            originalURL: urlSchemeTask.request.url ?? URL(string: "about:blank")!
        )

        workQueue.async { [self] in
            guard let url = urlSchemeTask.request.url,
                  let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
                taskState.didFail(with: SchemeError.invalidURL)
                return
            }

            guard let credentials = getCredentials() else {
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
            var request = URLRequest(url: realURL)
            if let rangeHeader = urlSchemeTask.request.value(forHTTPHeaderField: "Range") {
                request.setValue(rangeHeader, forHTTPHeaderField: "Range")
            }
            let dataTask = session.dataTask(with: request)
            syncQueue.async(flags: .barrier) { [self] in
                activeTasks[dataTask.taskIdentifier] = taskState
                urlSessionTasks[dataTask.taskIdentifier] = dataTask
            }
            dataTask.resume()
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        workQueue.async { [self] in
            let found: (taskId: Int, task: URLSessionDataTask)? = syncQueue.sync {
                guard let taskId = activeTasks.first(where: {
                    $0.value.schemeTask === urlSchemeTask
                })?.key else { return nil }
                activeTasks[taskId]?.stop()
                let task = urlSessionTasks[taskId]
                return task.map { (taskId, $0) }
            }

            guard let found else { return }

            syncQueue.async(flags: .barrier) { [self] in
                activeTasks.removeValue(forKey: found.taskId)
                urlSessionTasks.removeValue(forKey: found.taskId)
            }
            found.task.cancel()
        }
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
        if let acceptRanges = httpResponse.value(forHTTPHeaderField: "Accept-Ranges") {
            headers["Accept-Ranges"] = acceptRanges
        }
        if let contentRange = httpResponse.value(forHTTPHeaderField: "Content-Range") {
            headers["Content-Range"] = contentRange
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
            activeTasks[task.taskIdentifier]
        }

        guard let schemeTaskState else { return }

        var didComplete = false
        if let error, (error as NSError).code != NSURLErrorCancelled {
            didComplete = schemeTaskState.didFail(with: error)
        } else if error == nil {
            didComplete = schemeTaskState.didFinish()
        }

        if didComplete {
            syncQueue.async(flags: .barrier) { [self] in
                if activeTasks[task.taskIdentifier] === schemeTaskState {
                    activeTasks.removeValue(forKey: task.taskIdentifier)
                }
                urlSessionTasks.removeValue(forKey: task.taskIdentifier)
            }
        }
    }
}

private final class MediaSchemeTaskState {
    let schemeTask: WKURLSchemeTask
    var originalURL: URL

    private var lock = os_unfair_lock()
    private var isStopped = false
    private var isCompleted = false

    init(schemeTask: WKURLSchemeTask, originalURL: URL) {
        self.schemeTask = schemeTask
        self.originalURL = originalURL
    }

    func stop() {
        os_unfair_lock_lock(&lock)
        isStopped = true
        os_unfair_lock_unlock(&lock)
    }

    private var isInvalid: Bool {
        isStopped || isCompleted
    }

    private func safePerform(_ block: @escaping () -> Void) {
        DispatchQueue.main.async { [self] in
            os_unfair_lock_lock(&lock)
            let stopped = isStopped
            os_unfair_lock_unlock(&lock)
            guard !stopped else { return }
            try? ObjCExceptionCatcher.perform { block() }
        }
    }

    @discardableResult
    func didReceive(_ response: URLResponse) -> Bool {
        os_unfair_lock_lock(&lock)
        let invalid = isInvalid
        os_unfair_lock_unlock(&lock)
        guard !invalid else { return false }

        let task = schemeTask
        safePerform { task.didReceive(response) }
        return true
    }

    func didReceive(_ data: Data) {
        os_unfair_lock_lock(&lock)
        let invalid = isInvalid
        os_unfair_lock_unlock(&lock)
        guard !invalid else { return }

        let task = schemeTask
        safePerform { task.didReceive(data) }
    }

    @discardableResult
    func didFinish() -> Bool {
        os_unfair_lock_lock(&lock)
        guard !isInvalid else {
            os_unfair_lock_unlock(&lock)
            return false
        }
        isCompleted = true
        os_unfair_lock_unlock(&lock)

        let task = schemeTask
        safePerform { task.didFinish() }
        return true
    }

    @discardableResult
    func didFail(with error: Error) -> Bool {
        os_unfair_lock_lock(&lock)
        guard !isInvalid else {
            os_unfair_lock_unlock(&lock)
            return false
        }
        isCompleted = true
        os_unfair_lock_unlock(&lock)

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
