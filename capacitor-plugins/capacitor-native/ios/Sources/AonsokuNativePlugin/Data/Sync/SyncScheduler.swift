import Foundation
import UIKit
import BackgroundTasks

final class SyncScheduler {
    static let bgTaskIdentifier = "github.realtvop.aonsoku.sync.refresh"

    private let syncEngine: SyncEngine
    private var foregroundTimer: Timer?
    private var isInForeground = true

    init(syncEngine: SyncEngine) {
        self.syncEngine = syncEngine
        registerBackgroundTask()
        observeAppLifecycle()
    }

    func startForegroundSchedule() {
        stopForegroundSchedule()
        isInForeground = true
        foregroundTimer = Timer.scheduledTimer(withTimeInterval: SyncTier.t1.freshWindowSeconds, repeats: true) { [weak self] _ in
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

    // MARK: - Background Tasks

    private func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.bgTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleBackgroundRefresh(task as! BGAppRefreshTask)
        }
    }

    func scheduleNextBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.bgTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleBackgroundRefresh(_ task: BGAppRefreshTask) {
        scheduleNextBackgroundRefresh()

        let syncTask = Task {
            syncEngine.syncAll(includeFullSongs: false, mode: "incremental")
        }

        task.expirationHandler = { [weak self] in
            self?.syncEngine.cancel()
            syncTask.cancel()
        }

        Task {
            _ = await syncTask.value
            task.setTaskCompleted(success: true)
        }
    }

    // MARK: - App Lifecycle

    private func observeAppLifecycle() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    @objc private func appDidEnterBackground() {
        isInForeground = false
        stopForegroundSchedule()
        scheduleNextBackgroundRefresh()
    }

    @objc private func appWillEnterForeground() {
        isInForeground = true
        startForegroundSchedule()
        syncEngine.syncIncremental()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        stopForegroundSchedule()
    }
}
