import Foundation

final class SyncScheduler {
    private let syncEngine: SyncEngine
    private var foregroundTimer: Timer?

    init(syncEngine: SyncEngine) {
        self.syncEngine = syncEngine
    }

    func startForegroundSchedule() {
        stopForegroundSchedule()
        foregroundTimer = Timer.scheduledTimer(withTimeInterval: 5 * 60, repeats: true) { [weak self] _ in
            self?.syncEngine.syncIncremental()
        }
    }

    func stopForegroundSchedule() {
        foregroundTimer?.invalidate()
        foregroundTimer = nil
    }

    func triggerImmediateSync() {
        syncEngine.syncAll()
    }
}
