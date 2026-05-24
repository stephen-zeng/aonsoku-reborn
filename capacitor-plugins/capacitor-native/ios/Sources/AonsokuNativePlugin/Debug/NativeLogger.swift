import Foundation

final class NativeLogger {
    static let shared = NativeLogger()

    struct Entry {
        let timestamp: Date
        let level: Level
        let message: String
        let source: String

        enum Level: String, CaseIterable {
            case debug, info, warn, error
        }
    }

    private var entries: [Entry] = []
    private let maxEntries = 200
    private let queue = DispatchQueue(label: "com.aonsoku.NativeLogger")

    private init() {}

    func log(_ level: Entry.Level, _ message: String, source: String = "") {
        queue.async {
            let entry = Entry(timestamp: Date(), level: level, message: message, source: source)
            if self.entries.count >= self.maxEntries {
                self.entries.removeFirst()
            }
            self.entries.append(entry)
        }
    }

    func debug(_ message: String, source: String = "") {
        log(.debug, message, source: source)
    }

    func info(_ message: String, source: String = "") {
        log(.info, message, source: source)
    }

    func warn(_ message: String, source: String = "") {
        log(.warn, message, source: source)
    }

    func error(_ message: String, source: String = "") {
        log(.error, message, source: source)
    }

    func getEntries() -> [Entry] {
        queue.sync { entries }
    }

    func clear() {
        queue.async { self.entries.removeAll() }
    }
}
