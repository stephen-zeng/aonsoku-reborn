import Foundation
import Capacitor
import GRDB
import AonsokuNativeBridgePlugin

@objc(AonsokuNativeDataPlugin)
public class AonsokuNativeDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AonsokuNativeDataPlugin"
    public let jsName = "AonsokuNativeData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importBulk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncIncremental", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSyncState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getArtists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getArtist", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlbums", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlbum", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSongs", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPlaylists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPlaylist", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getGenres", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFavorites", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "search", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLyrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeLyrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCacheStats", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isDataAvailableOffline", returnType: CAPPluginReturnPromise),
    ]

    private var dbManager: DatabaseManager!
    private var syncEngine: SyncEngine!
    private var syncScheduler: SyncScheduler!
    private var eventEmitter: EventEmitter!
    private var queryBridge: DataQueryBridge!

    // MARK: - Initialization

    @objc func initialize(_ call: CAPPluginCall) {
        dbManager = DatabaseManager.shared
        eventEmitter = EventEmitter(plugin: self)

        let httpClient = SubsonicHTTPClient()
        syncEngine = SyncEngine(db: dbManager.dbPool, httpClient: httpClient)
        syncEngine.onSyncStateChanged = { [weak self] state in
            self?.eventEmitter.emitSyncStateChanged(state)
        }
        syncEngine.onDataChanged = { [weak self] tables in
            self?.eventEmitter.emitDataChanged(tables: tables, tier: "")
        }

        syncScheduler = SyncScheduler(syncEngine: syncEngine)
        queryBridge = DataQueryBridge(db: dbManager.dbPool)

        let hasData = (try? SyncStateRepository(db: dbManager.dbPool).getFullSyncTimestamp()) != nil

        call.resolve([
            "ready": true,
            "needsMigration": !hasData,
        ])

        syncScheduler.startForegroundSchedule()
        if hasData {
            syncEngine.syncIncremental()
        } else {
            syncEngine.syncAll()
        }
    }

    @objc func importBulk(_ call: CAPPluginCall) {
        // Will be implemented in Phase 4 (frontend integration)
        call.resolve()
    }

    // MARK: - Sync Control

    @objc func syncAll(_ call: CAPPluginCall) {
        syncEngine.syncAll()
        call.resolve()
    }

    @objc func syncIncremental(_ call: CAPPluginCall) {
        syncEngine.syncIncremental()
        call.resolve()
    }

    @objc func cancelSync(_ call: CAPPluginCall) {
        syncEngine.cancel()
        call.resolve()
    }

    @objc func getSyncState(_ call: CAPPluginCall) {
        call.resolve([
            "phase": "idle",
            "isSyncing": syncEngine?.isSyncing ?? false,
            "progress": 0,
            "processedItems": 0,
            "totalItems": 0,
        ])
    }

    // MARK: - Data Queries (stubs for Phase 3)

    @objc func getArtists(_ call: CAPPluginCall) {
        call.resolve(["items": [], "total": 0, "hasMore": false])
    }

    @objc func getArtist(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    @objc func getAlbums(_ call: CAPPluginCall) {
        call.resolve(["items": [], "total": 0, "hasMore": false])
    }

    @objc func getAlbum(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    @objc func getSongs(_ call: CAPPluginCall) {
        call.resolve(["items": [], "total": 0, "hasMore": false])
    }

    @objc func getPlaylists(_ call: CAPPluginCall) {
        call.resolve(["items": [], "total": 0, "hasMore": false])
    }

    @objc func getPlaylist(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    @objc func getGenres(_ call: CAPPluginCall) {
        call.resolve(["items": []])
    }

    @objc func getFavorites(_ call: CAPPluginCall) {
        call.resolve(["items": [], "total": 0, "hasMore": false])
    }

    @objc func search(_ call: CAPPluginCall) {
        call.resolve(["artists": [], "albums": [], "songs": []])
    }

    @objc func getLyrics(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    @objc func storeLyrics(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func getCacheStats(_ call: CAPPluginCall) {
        call.resolve([
            "totalItems": 0,
            "totalSizeBytes": 0,
            "audioCount": 0,
            "coverCount": 0,
        ])
    }

    @objc func isDataAvailableOffline(_ call: CAPPluginCall) {
        let lastSynced = try? SyncStateRepository(db: dbManager.dbPool).getFullSyncTimestamp()
        call.resolve([
            "available": lastSynced != nil,
            "lastSyncedAt": lastSynced as Any,
        ])
    }
}
