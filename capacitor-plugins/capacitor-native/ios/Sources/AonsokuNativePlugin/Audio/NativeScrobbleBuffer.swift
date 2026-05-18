import Foundation

struct ScrobbleEntry {
    let songId: String
    let playedDurationMs: Int
    let timestamp: Double

    func toDict() -> [String: Any] {
        return [
            "songId": songId,
            "playedDurationMs": playedDurationMs,
            "timestamp": timestamp,
        ]
    }
}

class NativeScrobbleBuffer {
    private static let persistenceKey = "com.aonsoku.scrobbleBuffer"
    private var entries: [ScrobbleEntry] = []
    private var currentSongId: String?
    private var currentSongDuration: Double?
    private var currentStartTime: Date?

    init() {
        loadPersistedEntries()
    }

    func startTracking(songId: String, duration: Double = 0) {
        flushCurrent()
        currentSongId = songId
        currentSongDuration = duration
        currentStartTime = Date()
    }

    func stopTracking() -> ScrobbleEntry? {
        return flushCurrent()
    }

    func getEntries() -> [ScrobbleEntry] {
        return entries
    }

    func clear() {
        entries = []
        UserDefaults.standard.removeObject(forKey: Self.persistenceKey)
    }

    func removeEntries(songIds: Set<String>) {
        entries.removeAll { songIds.contains($0.songId) }
        persistEntries()
    }

    func getEntriesAsArray() -> [[String: Any]] {
        return entries.map { $0.toDict() }
    }

    var lastEntryDuration: Double? {
        return currentSongDuration
    }

    @discardableResult
    private func flushCurrent() -> ScrobbleEntry? {
        guard let songId = currentSongId, let startTime = currentStartTime else {
            return nil
        }

        let durationMs = Int(Date().timeIntervalSince(startTime) * 1000)
        currentSongId = nil
        currentStartTime = nil

        guard durationMs > 0 else {
            currentSongDuration = nil
            return nil
        }

        let entry = ScrobbleEntry(
            songId: songId,
            playedDurationMs: durationMs,
            timestamp: startTime.timeIntervalSince1970 * 1000
        )
        entries.append(entry)
        persistEntries()

        let duration = currentSongDuration
        currentSongDuration = nil
        return ScrobbleEntry(
            songId: entry.songId,
            playedDurationMs: entry.playedDurationMs,
            timestamp: duration ?? 0
        )
    }

    private func loadPersistedEntries() {
        guard let data = UserDefaults.standard.data(forKey: Self.persistenceKey),
              let decoded = try? JSONDecoder().decode(
                  [PersistedScrobbleEntry].self, from: data
              ) else {
            return
        }
        entries = decoded.map {
            ScrobbleEntry(
                songId: $0.songId,
                playedDurationMs: $0.playedDurationMs,
                timestamp: $0.timestamp
            )
        }
    }

    private func persistEntries() {
        let persisted = entries.map {
            PersistedScrobbleEntry(
                songId: $0.songId,
                playedDurationMs: $0.playedDurationMs,
                timestamp: $0.timestamp
            )
        }
        if let data = try? JSONEncoder().encode(persisted) {
            UserDefaults.standard.set(data, forKey: Self.persistenceKey)
        }
    }
}

private struct PersistedScrobbleEntry: Codable {
    let songId: String
    let playedDurationMs: Int
    let timestamp: Double
}
