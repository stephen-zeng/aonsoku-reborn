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
    private var entries: [ScrobbleEntry] = []
    private var currentSongId: String?
    private var currentStartTime: Date?

    func startTracking(songId: String) {
        flushCurrent()
        currentSongId = songId
        currentStartTime = Date()
    }

    func stopTracking() {
        flushCurrent()
    }

    func getEntries() -> [ScrobbleEntry] {
        return entries
    }

    func clear() {
        entries = []
    }

    func getEntriesAsArray() -> [[String: Any]] {
        return entries.map { $0.toDict() }
    }

    private func flushCurrent() {
        guard let songId = currentSongId, let startTime = currentStartTime else {
            return
        }

        let durationMs = Int(Date().timeIntervalSince(startTime) * 1000)
        if durationMs > 0 {
            entries.append(ScrobbleEntry(
                songId: songId,
                playedDurationMs: durationMs,
                timestamp: startTime.timeIntervalSince1970 * 1000
            ))
        }

        currentSongId = nil
        currentStartTime = nil
    }
}
