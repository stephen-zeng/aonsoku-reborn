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
    private var accumulatedMs: Int = 0
    private var segmentStartTime: Date?
    private var trackingStartTimestamp: Double = 0

    init() {
        loadPersistedEntries()
    }

    func startTracking(songId: String, duration: Double = 0) {
        flushCurrent()
        currentSongId = songId
        currentSongDuration = duration
        accumulatedMs = 0
        segmentStartTime = Date()
        trackingStartTimestamp = Date().timeIntervalSince1970 * 1000
    }

    func pauseTracking() {
        guard segmentStartTime != nil else { return }
        accumulatedMs += currentSegmentMs()
        segmentStartTime = nil
    }

    func resumeTracking() {
        guard currentSongId != nil, segmentStartTime == nil else { return }
        segmentStartTime = Date()
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

    private func currentSegmentMs() -> Int {
        guard let start = segmentStartTime else { return 0 }
        return Int(Date().timeIntervalSince(start) * 1000)
    }

    @discardableResult
    private func flushCurrent() -> ScrobbleEntry? {
        guard let songId = currentSongId else {
            return nil
        }

        let totalMs = accumulatedMs + currentSegmentMs()
        let timestamp = trackingStartTimestamp

        currentSongId = nil
        segmentStartTime = nil
        accumulatedMs = 0

        guard totalMs > 0 else {
            currentSongDuration = nil
            return nil
        }

        let entry = ScrobbleEntry(
            songId: songId,
            playedDurationMs: totalMs,
            timestamp: timestamp
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
