import Foundation
import GRDB

final class PreferencesManager {
    static let shared = PreferencesManager()

    private let db: DatabasePool
    private var cache: [String: String] = [:]
    private let queue = DispatchQueue(label: "com.aonsoku.preferences", attributes: .concurrent)

    private init() {
        self.db = DatabaseManager.shared.dbPool
        loadAll()
    }

    func getString(_ key: String) -> String? {
        queue.sync { cache[key] }
    }

    func getBool(_ key: String) -> Bool? {
        guard let raw = getString(key) else { return nil }
        return raw == "true"
    }

    func getInt(_ key: String) -> Int? {
        guard let raw = getString(key) else { return nil }
        return Int(raw)
    }

    func getDouble(_ key: String) -> Double? {
        guard let raw = getString(key) else { return nil }
        return Double(raw)
    }

    func getJSON(_ key: String) -> Any? {
        guard let raw = getString(key),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    func getAll() -> [String: String] {
        queue.sync { cache }
    }

    func setValue(_ key: String, value: String) {
        queue.async(flags: .barrier) {
            self.cache[key] = value
        }
        writeToDb(key: key, value: value)
    }

    func setValues(_ pairs: [String: String]) {
        queue.async(flags: .barrier) {
            for (key, value) in pairs {
                self.cache[key] = value
            }
        }
        writeMultipleToDb(pairs)
    }

    func deleteValue(_ key: String) {
        queue.async(flags: .barrier) {
            self.cache.removeValue(forKey: key)
        }
        DispatchQueue.global(qos: .utility).async {
            try? self.db.write { db in
                try db.execute(sql: "DELETE FROM preferences WHERE key = ?", arguments: [key])
            }
        }
    }

    private func loadAll() {
        do {
            let rows = try db.read { db in
                try Row.fetchAll(db, sql: "SELECT key, value FROM preferences")
            }
            for row in rows {
                cache[row["key"] as String] = row["value"] as String
            }
        } catch {
            // Database may not have the table yet on first launch
        }
    }

    private func writeToDb(key: String, value: String) {
        let now = Int(Date().timeIntervalSince1970 * 1000)
        DispatchQueue.global(qos: .utility).async {
            try? self.db.write { db in
                try db.execute(
                    sql: """
                        INSERT OR REPLACE INTO preferences (key, value, updatedAt)
                        VALUES (?, ?, ?)
                        """,
                    arguments: [key, value, now]
                )
            }
        }
    }

    private func writeMultipleToDb(_ pairs: [String: String]) {
        let now = Int(Date().timeIntervalSince1970 * 1000)
        DispatchQueue.global(qos: .utility).async {
            try? self.db.write { db in
                for (key, value) in pairs {
                    try db.execute(
                        sql: """
                            INSERT OR REPLACE INTO preferences (key, value, updatedAt)
                            VALUES (?, ?, ?)
                            """,
                        arguments: [key, value, now]
                    )
                }
            }
        }
    }
}
