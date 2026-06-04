import Foundation
import Capacitor
import GRDB

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
        CAPPluginMethod(name: "storeCoverImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveCoverImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCoverImageSize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteCoverImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCoverImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadCoverImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadAvatar", returnType: CAPPluginReturnPromise),
    ]

    private var dbManager: DatabaseManager!
    private var syncEngine: SyncEngine!
    private var syncScheduler: SyncScheduler!
    private var eventEmitter: EventEmitter!
    private let dataQueue = DispatchQueue(label: "com.aonsoku.data.query", qos: .userInitiated, attributes: .concurrent)

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

    // MARK: - Data Queries

    @objc func getArtists(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 100
        let offset = call.getInt("offset") ?? 0
        let filter = ArtistQueryFilter(
            search: call.getString("search"),
            starredOnly: call.getBool("starredOnly"),
            sortBy: call.getString("sortBy"),
            sortOrder: call.getString("sortOrder")
        )

        dataQueue.async {
            do {
                let repo = ArtistRepository(db: self.dbManager.dbPool)
                let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                call.resolve([
                    "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                    "total": total,
                    "hasMore": offset + limit < total,
                ])
            } catch {
                call.reject("Failed to query artists: \(error.localizedDescription)")
            }
        }
    }

    @objc func getArtist(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Missing id parameter")
            return
        }
        dataQueue.async {
            do {
                let repo = ArtistRepository(db: self.dbManager.dbPool)
                if let artist = try repo.getById(id) {
                    call.resolve(artist.toDictionary().compactMapValues { $0 })
                } else {
                    call.resolve([:])
                }
            } catch {
                call.reject("Failed to get artist: \(error.localizedDescription)")
            }
        }
    }

    @objc func getAlbums(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 100
        let offset = call.getInt("offset") ?? 0
        let filter = AlbumQueryFilter(
            search: call.getString("search"),
            artistId: call.getString("artistId"),
            genre: call.getString("genre"),
            fromYear: call.getInt("fromYear"),
            toYear: call.getInt("toYear"),
            starredOnly: call.getBool("starredOnly"),
            sortBy: call.getString("sortBy"),
            sortOrder: call.getString("sortOrder")
        )

        dataQueue.async {
            do {
                let repo = AlbumRepository(db: self.dbManager.dbPool)
                let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                call.resolve([
                    "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                    "total": total,
                    "hasMore": offset + limit < total,
                ])
            } catch {
                call.reject("Failed to query albums: \(error.localizedDescription)")
            }
        }
    }

    @objc func getAlbum(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Missing id parameter")
            return
        }
        dataQueue.async {
            do {
                let repo = AlbumRepository(db: self.dbManager.dbPool)
                if let result = try repo.getWithSongs(id) {
                    var dict = result.album.toDictionary().compactMapValues { $0 }
                    dict["song"] = result.songs.map { $0.toDictionary().compactMapValues { $0 } }
                    call.resolve(dict)
                } else {
                    call.resolve([:])
                }
            } catch {
                call.reject("Failed to get album: \(error.localizedDescription)")
            }
        }
    }

    @objc func getSongs(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 100
        let offset = call.getInt("offset") ?? 0
        let filter = SongQueryFilter(
            search: call.getString("search"),
            albumId: call.getString("albumId"),
            artistId: call.getString("artistId"),
            genre: call.getString("genre"),
            starredOnly: call.getBool("starredOnly"),
            sortBy: call.getString("sortBy"),
            sortOrder: call.getString("sortOrder")
        )

        dataQueue.async {
            do {
                let repo = SongRepository(db: self.dbManager.dbPool)
                let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                call.resolve([
                    "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                    "total": total,
                    "hasMore": offset + limit < total,
                ])
            } catch {
                call.reject("Failed to query songs: \(error.localizedDescription)")
            }
        }
    }

    @objc func getPlaylists(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 100
        let offset = call.getInt("offset") ?? 0

        dataQueue.async {
            do {
                let repo = PlaylistRepository(db: self.dbManager.dbPool)
                let (items, total) = try repo.getAll(limit: limit, offset: offset)
                call.resolve([
                    "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                    "total": total,
                    "hasMore": offset + limit < total,
                ])
            } catch {
                call.reject("Failed to query playlists: \(error.localizedDescription)")
            }
        }
    }

    @objc func getPlaylist(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Missing id parameter")
            return
        }
        dataQueue.async {
            do {
                let repo = PlaylistRepository(db: self.dbManager.dbPool)
                if let detail = try repo.getDetailById(id) {
                    call.resolve(detail.toDictionary().compactMapValues { $0 })
                } else {
                    call.resolve([:])
                }
            } catch {
                call.reject("Failed to get playlist: \(error.localizedDescription)")
            }
        }
    }

    @objc func getGenres(_ call: CAPPluginCall) {
        dataQueue.async {
            do {
                let repo = GenreRepository(db: self.dbManager.dbPool)
                let items = try repo.getAll()
                call.resolve([
                    "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                ])
            } catch {
                call.reject("Failed to query genres: \(error.localizedDescription)")
            }
        }
    }

    @objc func getFavorites(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 100
        let offset = call.getInt("offset") ?? 0
        let type = call.getString("type") ?? "songs"

        dataQueue.async {
            do {
                switch type {
                case "artists":
                    let repo = ArtistRepository(db: self.dbManager.dbPool)
                    let filter = ArtistQueryFilter(starredOnly: true, sortBy: "starredAt", sortOrder: "desc")
                    let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                    call.resolve([
                        "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                        "total": total,
                        "hasMore": offset + limit < total,
                    ])
                case "albums":
                    let repo = AlbumRepository(db: self.dbManager.dbPool)
                    let filter = AlbumQueryFilter(starredOnly: true, sortBy: "starredAt", sortOrder: "desc")
                    let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                    call.resolve([
                        "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                        "total": total,
                        "hasMore": offset + limit < total,
                    ])
                default:
                    let repo = SongRepository(db: self.dbManager.dbPool)
                    let filter = SongQueryFilter(starredOnly: true, sortBy: "starredAt", sortOrder: "desc")
                    let (items, total) = try repo.getAll(limit: limit, offset: offset, filter: filter)
                    call.resolve([
                        "items": items.map { $0.toDictionary().compactMapValues { $0 } },
                        "total": total,
                        "hasMore": offset + limit < total,
                    ])
                }
            } catch {
                call.reject("Failed to query favorites: \(error.localizedDescription)")
            }
        }
    }

    @objc func search(_ call: CAPPluginCall) {
        guard let query = call.getString("query"), !query.isEmpty else {
            call.resolve(["artists": [], "albums": [], "songs": []])
            return
        }

        let artistCount = call.getInt("artistCount") ?? 20
        let albumCount = call.getInt("albumCount") ?? 20
        let songCount = call.getInt("songCount") ?? 20

        guard let artistCondition = SearchHelper.buildCondition(query: query, columns: ["name"]),
              let albumCondition = SearchHelper.buildCondition(query: query, columns: ["name", "artist"]),
              let songCondition = SearchHelper.buildCondition(query: query, columns: ["title", "artist", "album"])
        else {
            call.resolve(["artists": [], "albums": [], "songs": []])
            return
        }

        dataQueue.async {
            do {
                let artists: [[String: Any]] = try self.dbManager.dbPool.read { db in
                    try ArtistRecord
                        .filter(artistCondition)
                        .limit(artistCount)
                        .fetchAll(db)
                        .map { $0.toDictionary().compactMapValues { $0 } }
                }

                let albums: [[String: Any]] = try self.dbManager.dbPool.read { db in
                    try AlbumRecord
                        .filter(albumCondition)
                        .limit(albumCount)
                        .fetchAll(db)
                        .map { $0.toDictionary().compactMapValues { $0 } }
                }

                let songs: [[String: Any]] = try self.dbManager.dbPool.read { db in
                    try SongRecord
                        .filter(songCondition)
                        .limit(songCount)
                        .fetchAll(db)
                        .map { $0.toDictionary().compactMapValues { $0 } }
                }

                call.resolve([
                    "artists": artists,
                    "albums": albums,
                    "songs": songs,
                ])
            } catch {
                call.reject("Failed to search: \(error.localizedDescription)")
            }
        }
    }

    @objc func getLyrics(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId") else {
            call.reject("Missing songId parameter")
            return
        }
        dataQueue.async {
            do {
                let repo = LyricsRepository(db: self.dbManager.dbPool)
                if let lyrics = try repo.getBySongId(songId) {
                    try? repo.updateAccessTime(songId: songId)
                    call.resolve(lyrics.toDictionary().compactMapValues { $0 })
                } else {
                    call.resolve([:])
                }
            } catch {
                call.reject("Failed to get lyrics: \(error.localizedDescription)")
            }
        }
    }

    @objc func storeLyrics(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"),
              let content = call.getString("content") else {
            call.reject("Missing required parameters")
            return
        }
        let synced = call.getBool("synced") ?? false
        let now = Int(Date().timeIntervalSince1970 * 1000)

        dataQueue.async {
            do {
                let repo = LyricsRepository(db: self.dbManager.dbPool)
                try repo.upsert(LyricsRecord(
                    songId: songId,
                    content: content,
                    synced: synced,
                    cachedAt: now,
                    lastAccessedAt: now
                ))
                call.resolve()
            } catch {
                call.reject("Failed to store lyrics: \(error.localizedDescription)")
            }
        }
    }

    @objc func getCacheStats(_ call: CAPPluginCall) {
        dataQueue.async {
            do {
                let repo = CacheMetaRepository(db: self.dbManager.dbPool)
                let stats = try repo.getStats()
                call.resolve([
                    "totalItems": stats.totalItems,
                    "totalSizeBytes": stats.totalSizeBytes,
                    "audioCount": stats.audioCount,
                    "coverCount": stats.coverCount,
                ])
            } catch {
                call.reject("Failed to get cache stats: \(error.localizedDescription)")
            }
        }
    }

    @objc func isDataAvailableOffline(_ call: CAPPluginCall) {
        dataQueue.async {
            let lastSynced = try? SyncStateRepository(db: self.dbManager.dbPool).getFullSyncTimestamp()
            call.resolve([
                "available": lastSynced != nil,
                "lastSyncedAt": lastSynced as Any,
            ])
        }
    }

    // MARK: - Cover Image Cache

    private func ensureInitialized() {
        if dbManager == nil {
            dbManager = DatabaseManager.shared
        }
    }

    @objc func storeCoverImage(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing coverArtId")
            return
        }
        guard let dataBase64 = call.getString("dataBase64"), !dataBase64.isEmpty else {
            call.reject("Missing dataBase64")
            return
        }
        let contentType = call.getString("contentType") ?? "image/jpeg"
        let coverSize = call.getString("coverSize") ?? "700"

        DispatchQueue.global(qos: .utility).async {
            do {
                guard let data = Data(base64Encoded: dataBase64) else {
                    call.reject("Invalid base64 data")
                    return
                }
                let manager = ImageCacheManager(db: self.dbManager.dbPool)
                let fileURL = try manager.storeCoverImage(
                    coverArtId: coverArtId,
                    data: data,
                    contentType: contentType,
                    coverSize: coverSize
                )
                DispatchQueue.main.async {
                    call.resolve([
                        "file": [
                            "coverArtId": coverArtId,
                            "uri": fileURL.absoluteString,
                            "contentType": contentType,
                            "sizeBytes": data.count,
                            "coverSize": coverSize,
                        ] as [String: Any],
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Failed to store cover image: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func resolveCoverImage(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing coverArtId")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            let manager = ImageCacheManager(db: self.dbManager.dbPool)
            guard let fileURL = manager.resolveCoverImage(coverArtId: coverArtId) else {
                DispatchQueue.main.async {
                    call.resolve(["file": NSNull()])
                }
                return
            }

            let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
            let sizeBytes = (attrs?[.size] as? NSNumber)?.intValue

            DispatchQueue.main.async {
                call.resolve([
                    "file": [
                        "coverArtId": coverArtId,
                        "uri": fileURL.absoluteString,
                        "sizeBytes": sizeBytes as Any,
                    ] as [String: Any],
                ])
            }
        }
    }

    @objc func getCoverImageSize(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing coverArtId")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            let manager = ImageCacheManager(db: self.dbManager.dbPool)
            let result = manager.getCoverImageSize(coverArtId: coverArtId)
            DispatchQueue.main.async {
                call.resolve([
                    "sizeBytes": result.map { NSNumber(value: $0.sizeBytes) } ?? NSNull(),
                    "coverSize": result?.coverSize ?? NSNull(),
                ])
            }
        }
    }

    @objc func deleteCoverImage(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing coverArtId")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let manager = ImageCacheManager(db: self.dbManager.dbPool)
                let deleted = try manager.deleteCoverImage(coverArtId: coverArtId)
                DispatchQueue.main.async {
                    call.resolve(["deleted": deleted])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Failed to delete cover image: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func clearCoverImages(_ call: CAPPluginCall) {
        ensureInitialized()
        DispatchQueue.global(qos: .utility).async {
            do {
                let manager = ImageCacheManager(db: self.dbManager.dbPool)
                let deletedCount = try manager.clearCoverImages()
                DispatchQueue.main.async {
                    call.resolve(["deletedCount": deletedCount])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Failed to clear cover images: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func downloadAvatar(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let username = call.getString("username"), !username.isEmpty else {
            call.reject("Missing username")
            return
        }
        let size = call.getString("size") ?? "150"

        Task {
            do {
                let manager = ImageCacheManager(db: self.dbManager.dbPool)
                let fileURL = try await manager.downloadAvatar(username: username, size: size)
                let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
                let sizeBytes = (attrs?[.size] as? NSNumber)?.intValue
                call.resolve([
                    "file": [
                        "coverArtId": username,
                        "uri": fileURL.absoluteString,
                        "sizeBytes": sizeBytes as Any,
                        "coverSize": size,
                    ] as [String: Any],
                ])
            } catch {
                call.reject("Failed to download avatar: \(error.localizedDescription)")
            }
        }
    }

    @objc func downloadCoverImage(_ call: CAPPluginCall) {
        ensureInitialized()
        guard let coverArtId = call.getString("coverArtId"), !coverArtId.isEmpty else {
            call.reject("Missing coverArtId")
            return
        }
        let size = call.getString("size") ?? "700"

        Task {
            do {
                let manager = ImageCacheManager(db: self.dbManager.dbPool)
                let fileURL = try await manager.downloadCoverImage(coverArtId: coverArtId, size: size)
                let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
                let sizeBytes = (attrs?[.size] as? NSNumber)?.intValue
                call.resolve([
                    "file": [
                        "coverArtId": coverArtId,
                        "uri": fileURL.absoluteString,
                        "sizeBytes": sizeBytes as Any,
                        "coverSize": size,
                    ] as [String: Any],
                ])
            } catch {
                call.reject("Failed to download cover image: \(error.localizedDescription)")
            }
        }
    }
}
