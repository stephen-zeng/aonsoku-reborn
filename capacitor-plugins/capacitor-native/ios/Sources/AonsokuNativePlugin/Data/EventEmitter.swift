import Foundation
import Capacitor

final class EventEmitter {
    private weak var plugin: CAPPlugin?
    private var syncStateTimer: Timer?
    private var pendingSyncState: [String: Any]?

    init(plugin: CAPPlugin) {
        self.plugin = plugin
    }

    func emitSyncStateChanged(_ state: [String: Any]) {
        pendingSyncState = state
        if syncStateTimer == nil {
            syncStateTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: false) { [weak self] _ in
                self?.flushSyncState()
            }
        }
    }

    func emitDataChanged(tables: [String], tier: String) {
        plugin?.notifyListeners("dataChanged", data: [
            "tables": tables,
            "tier": tier,
        ])
    }

    private func flushSyncState() {
        syncStateTimer = nil
        guard let state = pendingSyncState else { return }
        pendingSyncState = nil
        plugin?.notifyListeners("syncStateChanged", data: state)
    }

    func forceFlush() {
        syncStateTimer?.invalidate()
        syncStateTimer = nil
        flushSyncState()
    }
}
