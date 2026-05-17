import Foundation
import GRDB
import AonsokuNativeBridgePlugin

final class SyncEngine {
    private let db: DatabasePool
    private let httpClient: SubsonicHTTPClient
    private let syncStateRepo: SyncStateRepository
    private var currentTask: Task<Void, Never>?
    private var generation: Int = 0

    var onSyncStateChanged: (([String: Any]) -> Void)?
    var onDataChanged: (([String]) -> Void)?

    init(db: DatabasePool, httpClient: SubsonicHTTPClient) {
        self.db = db
        self.httpClient = httpClient
        self.syncStateRepo = SyncStateRepository(db: db)
    }

    func syncAll(includeFullSongs: Bool = true, mode: String = "full") {
        let gen = generation + 1
        generation = gen

        currentTask?.cancel()
        currentTask = Task { [weak self] in
            guard let self else { return }
            await self.performSync(generation: gen, includeFullSongs: includeFullSongs, mode: mode)
        }
    }

    func syncIncremental() {
        syncAll(includeFullSongs: true, mode: "incremental")
    }

    func cancel() {
        currentTask?.cancel()
        currentTask = nil
    }

    var isSyncing: Bool {
        currentTask != nil
    }

    private func performSync(generation: Int, includeFullSongs: Bool, mode: String) async {
        // Will be fully implemented in Phase 2
        emitState(phase: "idle", tier: nil, processed: 0, total: 0)

        guard self.generation == generation else { return }
        emitState(phase: "done", tier: nil, processed: 0, total: 0)
    }

    private func shouldSkipTier(_ tier: SyncTier, mode: String) -> Bool {
        if mode == "full" { return false }
        guard let lastSynced = try? syncStateRepo.getLastSyncedAt(tier: tier.rawValue) else {
            return false
        }
        let now = Int(Date().timeIntervalSince1970 * 1000)
        return (now - lastSynced) < tier.freshWindowMs
    }

    private func emitState(phase: String, tier: String?, processed: Int, total: Int) {
        let state: [String: Any] = [
            "phase": phase,
            "tier": tier as Any,
            "isSyncing": phase != "done" && phase != "error" && phase != "cancelled",
            "progress": total > 0 ? Int((Double(processed) / Double(total)) * 100) : 0,
            "processedItems": processed,
            "totalItems": total,
        ]
        onSyncStateChanged?(state)
    }
}
