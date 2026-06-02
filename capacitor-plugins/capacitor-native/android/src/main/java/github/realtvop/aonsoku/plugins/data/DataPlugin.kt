package github.realtvop.aonsoku.plugins.data

import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import github.realtvop.aonsoku.plugins.bridge.AndroidCredentialStore
import github.realtvop.aonsoku.plugins.bridge.SubsonicHttpClient
import github.realtvop.aonsoku.plugins.data.db.AonsokuDatabase
import github.realtvop.aonsoku.plugins.data.db.entity.LyricsEntity
import github.realtvop.aonsoku.plugins.data.db.toJSObject
import github.realtvop.aonsoku.plugins.data.db.toJSArray
import github.realtvop.aonsoku.plugins.data.image.ImageCacheManager
import github.realtvop.aonsoku.plugins.data.sync.SyncEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "AonsokuNativeData")
class DataPlugin : Plugin() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = SubsonicHttpClient()
    private lateinit var credStore: AndroidCredentialStore
    private lateinit var db: AonsokuDatabase
    private lateinit var sync: SyncEngine
    private lateinit var imgCache: ImageCacheManager
    private lateinit var emitter: EventEmitter
    private var ready = false

    private fun init() {
        if (ready) return
        val ctx = context ?: return
        credStore = AndroidCredentialStore(ctx)
        db = AonsokuDatabase.getInstance(ctx)
        imgCache = ImageCacheManager(ctx.cacheDir, db.cacheMetaDao())
        emitter = EventEmitter { event, data -> notifyListeners(event, data) }
        sync = SyncEngine(http, db.artistDao(), db.albumDao(), db.songDao(), db.playlistDao(), db.genreDao(), db.syncStateDao())
        sync.onSyncStateChanged = { emitter.emitSyncStateChanged(it) }
        sync.onDataChanged = { emitter.emitDataChanged(it, "") }
        credStore.retrieve()?.let { sync.updateCredentials(it) }
        ready = true
    }

    override fun handleOnDestroy() { scope.cancel(); if (::sync.isInitialized) sync.cleanup(); super.handleOnDestroy() }

    @PluginMethod fun initialize(call: PluginCall) {
        try {
            init()
            val hasSync = kotlinx.coroutines.runBlocking { try { db.syncStateDao().get("full-sync") != null } catch (_: Exception) { false } }
            resolve(call, JSObject().apply { put("ready", true); put("needsMigration", !hasSync) })
            credStore.retrieve()?.let { sync.updateCredentials(it); if (hasSync) sync.syncIncremental() else sync.syncAll() }
        } catch (e: Exception) { reject(call, "Init: ${e.message}") }
    }

    @PluginMethod fun importBulk(call: PluginCall) { call.resolve() }
    @PluginMethod fun syncAll(call: PluginCall) { init(); credStore.retrieve()?.let { sync.updateCredentials(it) }; sync.syncAll(); call.resolve() }
    @PluginMethod fun syncIncremental(call: PluginCall) { init(); credStore.retrieve()?.let { sync.updateCredentials(it) }; sync.syncIncremental(); call.resolve() }
    @PluginMethod fun cancelSync(call: PluginCall) { sync.cancel(); call.resolve() }
    @PluginMethod fun getSyncState(call: PluginCall) { call.resolve(JSObject().apply { put("phase", "idle"); put("isSyncing", sync.isSyncing) }) }

    @PluginMethod fun getArtists(call: PluginCall) {
        init(); val l = call.getInt("limit") ?: 100; val o = call.getInt("offset") ?: 0; val s = call.getString("search"); val st = if (call.getBoolean("starredOnly") == true) 1 else 0; val sb = call.getString("sortBy")
        scope.launch { try { val items = db.artistDao().getFiltered(l, o, s, st, sb); val t = db.artistDao().countFiltered(s, st); resolve(call, JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", t); put("hasMore", o + l < t) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getArtist(call: PluginCall) {
        val id = call.getString("id") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { resolve(call, db.artistDao().getById(id)?.toJSObject() ?: JSObject()) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getAlbums(call: PluginCall) {
        init(); val l = call.getInt("limit") ?: 100; val o = call.getInt("offset") ?: 0
        val s = call.getString("search"); val ai = call.getString("artistId"); val g = call.getString("genre")
        val fy = call.getInt("fromYear"); val ty = call.getInt("toYear"); val st = if (call.getBoolean("starredOnly") == true) 1 else 0; val sb = call.getString("sortBy")
        scope.launch { try { val items = db.albumDao().getFiltered(l, o, s, ai, g, fy, ty, st, sb); val t = db.albumDao().countFiltered(s, ai, g, fy, ty, st); resolve(call, JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", t); put("hasMore", o + l < t) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getAlbum(call: PluginCall) {
        val id = call.getString("id") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { val a = db.albumDao().getById(id); if (a != null) { val obj = a.toJSObject(); obj.put("song", db.albumDao().getSongsByAlbumId(id).map { it.toJSObject() }.toJSArray()); resolve(call, obj) } else resolve(call, JSObject()) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getSongs(call: PluginCall) {
        init(); val l = call.getInt("limit") ?: 100; val o = call.getInt("offset") ?: 0
        val s = call.getString("search"); val ai = call.getString("albumId"); val ari = call.getString("artistId"); val g = call.getString("genre"); val st = if (call.getBoolean("starredOnly") == true) 1 else 0; val sb = call.getString("sortBy")
        scope.launch { try { val items = db.songDao().getFiltered(l, o, s, ai, ari, g, st, sb); val t = db.songDao().countFiltered(s, ai, ari, g, st); resolve(call, JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", t); put("hasMore", o + l < t) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getPlaylists(call: PluginCall) {
        init(); val l = call.getInt("limit") ?: 100; val o = call.getInt("offset") ?: 0
        scope.launch { try { val items = db.playlistDao().getAll(l, o); val t = db.playlistDao().count(); resolve(call, JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", t); put("hasMore", o + l < t) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getPlaylist(call: PluginCall) {
        val id = call.getString("id") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { resolve(call, db.playlistDao().getDetailById(id)?.toJSObject() ?: JSObject()) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getGenres(call: PluginCall) {
        init()
        scope.launch { try { resolve(call, JSObject().apply { put("items", db.genreDao().getAll().map { it.toJSObject() }.toJSArray()) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getFavorites(call: PluginCall) {
        init(); val l = call.getInt("limit") ?: 100; val o = call.getInt("offset") ?: 0; val t = call.getString("type") ?: "songs"
        scope.launch {
            try {
                val result = when (t) {
                    "artists" -> { val items = db.artistDao().getFiltered(l, o, null, 1, "starredAt"); val total = db.artistDao().countFiltered(null, 1); JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", total); put("hasMore", o + l < total) } }
                    "albums" -> { val items = db.albumDao().getFiltered(l, o, null, null, null, null, null, 1, "starredAt"); val total = db.albumDao().countFiltered(null, null, null, null, null, 1); JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", total); put("hasMore", o + l < total) } }
                    else -> { val items = db.songDao().getFiltered(l, o, null, null, null, null, 1, "starredAt"); val total = db.songDao().countFiltered(null, null, null, null, 1); JSObject().apply { put("items", items.map { it.toJSObject() }.toJSArray()); put("total", total); put("hasMore", o + l < total) } }
                }
                resolve(call, result)
            } catch (e: Exception) { reject(call, e.message ?: "error") }
        }
    }

    @PluginMethod fun search(call: PluginCall) {
        val query = call.getString("query") ?: ""
        if (query.isBlank()) { resolve(call, JSObject().apply { put("artists", JSONArray()); put("albums", JSONArray()); put("songs", JSONArray()) }); return }
        init(); val ac = call.getInt("artistCount") ?: 20; val alc = call.getInt("albumCount") ?: 20; val sc = call.getInt("songCount") ?: 20
        scope.launch {
            try {
                val artists = db.artistDao().getFiltered(ac, 0, query, 0, "name").map { it.toJSObject() }.toJSArray()
                val albums = db.albumDao().getFiltered(alc, 0, query, null, null, null, null, 0, "name").map { it.toJSObject() }.toJSArray()
                val songs = db.songDao().getFiltered(sc, 0, query, null, null, null, 0, "title").map { it.toJSObject() }.toJSArray()
                resolve(call, JSObject().apply { put("artists", artists); put("albums", albums); put("songs", songs) })
            } catch (e: Exception) { reject(call, e.message ?: "error") }
        }
    }

    @PluginMethod fun getLyrics(call: PluginCall) {
        val songId = call.getString("songId") ?: run { reject(call, "no songId"); return }; init()
        scope.launch { try { val lyr = db.lyricsDao().getBySongId(songId); if (lyr != null) { db.lyricsDao().updateAccessTime(songId, System.currentTimeMillis()); resolve(call, lyr.toJSObject()) } else resolve(call, JSObject()) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun storeLyrics(call: PluginCall) {
        val sid = call.getString("songId"); val ct = call.getString("content")
        if (sid == null || ct == null) { reject(call, "missing params"); return }; init()
        val synced = call.getBoolean("synced") ?: false; val now = System.currentTimeMillis()
        scope.launch { try { db.lyricsDao().upsert(LyricsEntity(sid, ct, synced, now, now)); resolve(call) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getCacheStats(call: PluginCall) {
        init()
        scope.launch { try { resolve(call, JSObject().apply { put("totalItems", db.cacheMetaDao().totalItems()); put("totalSizeBytes", db.cacheMetaDao().totalSizeBytes()); put("audioCount", db.cacheMetaDao().audioCount()); put("coverCount", db.cacheMetaDao().coverCount()) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun isDataAvailableOffline(call: PluginCall) {
        init()
        scope.launch { try { val ts = db.syncStateDao().getLastSyncedAt("full-sync"); resolve(call, JSObject().apply { put("available", ts != null); if (ts != null) put("lastSyncedAt", ts) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun storeCoverImage(call: PluginCall) {
        init(); val id = call.getString("coverArtId") ?: run { reject(call, "no id"); return }; val b = call.getString("dataBase64") ?: run { reject(call, "no data"); return }
        val ct = call.getString("contentType") ?: "image/jpeg"; val cs = call.getString("coverSize") ?: "700"
        scope.launch { try { val data = Base64.decode(b, Base64.DEFAULT); val f = imgCache.storeCoverImage(id, data, ct, cs); resolve(call, JSObject().apply { put("file", JSObject().apply { put("coverArtId", id); put("uri", f.toURI().toString()); put("contentType", ct); put("sizeBytes", data.size); put("coverSize", cs) }) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun resolveCoverImage(call: PluginCall) {
        val id = call.getString("coverArtId") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { val f = imgCache.resolveCoverImage(id); if (f != null) resolve(call, JSObject().apply { put("file", JSObject().apply { put("coverArtId", id); put("uri", f.toURI().toString()); put("sizeBytes", f.length()) }) }) else resolve(call, JSObject().apply { put("file", JSONObject.NULL) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun getCoverImageSize(call: PluginCall) {
        val id = call.getString("coverArtId") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { val r = imgCache.getCoverImageSize(id); resolve(call, JSObject().apply { if (r != null) { put("sizeBytes", r.first); put("coverSize", r.second ?: JSONObject.NULL) } else { put("sizeBytes", JSONObject.NULL); put("coverSize", JSONObject.NULL) } }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun deleteCoverImage(call: PluginCall) {
        val id = call.getString("coverArtId") ?: run { reject(call, "no id"); return }; init()
        scope.launch { try { resolve(call, JSObject().apply { put("deleted", imgCache.deleteCoverImage(id)) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun clearCoverImages(call: PluginCall) {
        init()
        scope.launch { try { resolve(call, JSObject().apply { put("deletedCount", imgCache.clearCoverImages()) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun downloadCoverImage(call: PluginCall) {
        init(); val id = call.getString("coverArtId") ?: run { reject(call, "no id"); return }; val size = call.getString("size") ?: "700"
        scope.launch { try { val c = credStore.retrieve() ?: run { reject(call, "no creds"); return@launch }; val f = imgCache.downloadCoverImage(id, size, c); resolve(call, JSObject().apply { put("file", JSObject().apply { put("coverArtId", id); put("uri", f.toURI().toString()); put("sizeBytes", f.length()); put("coverSize", size) }) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    @PluginMethod fun downloadAvatar(call: PluginCall) {
        init(); val username = call.getString("username") ?: run { reject(call, "no username"); return }; val size = call.getString("size") ?: "150"
        scope.launch { try { val c = credStore.retrieve() ?: run { reject(call, "no creds"); return@launch }; val f = imgCache.downloadAvatar(username, size, c); resolve(call, JSObject().apply { put("file", JSObject().apply { put("coverArtId", username); put("uri", f.toURI().toString()); put("sizeBytes", f.length()); put("coverSize", size) }) }) } catch (e: Exception) { reject(call, e.message ?: "error") } }
    }

    private fun resolve(call: PluginCall) { mainHandler.post { call.resolve() } }
    private fun resolve(call: PluginCall, d: JSObject) { mainHandler.post { call.resolve(d) } }
    private fun reject(call: PluginCall, m: String) { mainHandler.post { call.reject(m) } }
}
