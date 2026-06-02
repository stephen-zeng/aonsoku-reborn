package github.realtvop.aonsoku.plugins.audio

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import github.realtvop.aonsoku.plugins.error.AonsokuNativeError
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

@CapacitorPlugin(
    name = "AonsokuNativeAudio",
    permissions = [
        Permission(
            alias = "post_notifications",
            strings = ["android.permission.POST_NOTIFICATIONS"]
        )
    ]
)
class AudioPlugin : Plugin() {
    private val pluginName = "AudioPlugin"
    private val mainHandler = Handler(Looper.getMainLooper())
    private var playbackService: PlaybackService? = null
    private var isBound = false
    private var currentRequestId: String? = null
    private var playerListener: Player.Listener? = null

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val downloadListener = object : PlaybackService.DownloadListener {
        override fun onDownloadProgress(songId: String, loaded: Long, total: Long) {
            if (playbackService?.isBackgroundCache(songId) == true) return
            notifyListeners("downloadProgress", JSObject().apply {
                put("songId", songId)
                put("loaded", loaded)
                put("total", total)
            })
        }

        override fun onDownloadCompleted(songId: String, fileUri: String, contentType: String, sizeBytes: Long) {
            if (playbackService?.isBackgroundCache(songId) == true) {
                playbackService?.removeBackgroundCache(songId)
                notifyListeners("streamCacheCompleted", JSObject().apply {
                    put("songId", songId)
                    put("uri", fileUri)
                    put("contentType", contentType)
                    put("sizeBytes", sizeBytes)
                })
                return
            }
            notifyListeners("downloadCompleted", JSObject().apply {
                put("songId", songId)
                put("uri", fileUri)
                put("contentType", contentType)
                put("sizeBytes", sizeBytes)
            })
        }

        override fun onDownloadFailed(songId: String, errorMessage: String) {
            if (playbackService?.isBackgroundCache(songId) == true) {
                playbackService?.removeBackgroundCache(songId)
                return
            }
            notifyListeners("downloadFailed", JSObject().apply {
                put("songId", songId)
                put("error", errorMessage)
            })
        }
    }

    private val serviceListener = object : PlaybackService.Listener {
        override fun onRemoteCommand(command: String, position: Double?) {
            emitRemoteCommand(command, position)
        }

        override fun onQueueStateChanged(currentIndex: Int, songId: String, reason: String, isInUserQueue: Boolean) {
            val data = JSObject().apply {
                put("currentIndex", currentIndex)
                put("songId", songId)
                put("reason", reason)
                put("isInUserQueue", isInUserQueue)
            }
            notifyListeners("queueStateChanged", data)
        }

        override fun onQueueContentsChanged(reason: String) {
            val data = JSObject().apply {
                put("reason", reason)
            }
            notifyListeners("queueContentsChanged", data)
        }

        override fun onPlaybackStateChanged(state: String) {
            emitPlaybackState(state, currentRequestId)
        }

        override fun onEnded(reason: String) {
            notifyListeners("ended", JSObject().apply {
                put("requestId", currentRequestId ?: JSONObject.NULL)
                put("reason", reason)
            })
            emitPlaybackState("ended", currentRequestId)
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? PlaybackService.LocalBinder
            val currentService = binder?.getService()
            playbackService = currentService
            isBound = true

            currentService?.addListener(serviceListener)
            currentService?.addDownloadListener(downloadListener)
            setupPlayerListener()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playbackService?.removeListener(serviceListener)
            playbackService?.removeDownloadListener(downloadListener)
            playbackService = null
            isBound = false
        }
    }

    override fun load() {
        super.load()
        bindPlaybackService()
    }

    override fun handleOnDestroy() {
        playbackService?.removeListener(serviceListener)
        playbackService?.removeDownloadListener(downloadListener)
        if (isBound) {
            context.unbindService(connection)
            isBound = false
        }
        mainHandler.removeCallbacks(progressRunnable)
        pluginScope.cancel()
        super.handleOnDestroy()
    }

    private fun bindPlaybackService() {
        val intent = Intent(context, PlaybackService::class.java)
        try {
            context.startService(intent)
        } catch (_: Exception) {
            // Foreground limits might apply on some versions if started in background,
            // but we are in the main app startup flow.
        }
        context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    private fun setupPlayerListener() {
        val player = playbackService?.getPlayer() ?: return
        if (playerListener != null) {
            player.removeListener(playerListener!!)
        }

        playerListener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                handlePlaybackStateChanged(playbackState)
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                handleIsPlayingChanged(isPlaying)
            }

            override fun onPlayerError(error: PlaybackException) {
                handlePlayerError(error)
            }
        }
        player.addListener(playerListener!!)
    }

    private fun handlePlaybackStateChanged(playbackState: Int) {
        val player = playbackService?.getPlayer() ?: return
        val requestId = currentRequestId
        when (playbackState) {
            Player.STATE_BUFFERING -> {
                notifyListeners("bufferingChanged", JSObject().apply {
                    put("isBuffering", true)
                    put("requestId", requestId ?: JSONObject.NULL)
                })
            }
            Player.STATE_READY -> {
                notifyListeners("bufferingChanged", JSObject().apply {
                    put("isBuffering", false)
                    put("requestId", requestId ?: JSONObject.NULL)
                })

                val durationSec = player.duration / 1000.0
                notifyListeners("durationChanged", JSObject().apply {
                    put("duration", durationSec)
                    put("requestId", requestId ?: JSONObject.NULL)
                })

                if (!player.isPlaying) {
                    emitPlaybackState("paused", requestId)
                } else {
                    emitPlaybackState("playing", requestId)
                }
            }
            Player.STATE_ENDED -> {
                val service = playbackService
                if (service != null && service.isQueueEngineActive) {
                    // Handled internally by service queueEngine
                } else {
                    notifyListeners("bufferingChanged", JSObject().apply {
                        put("isBuffering", false)
                        put("requestId", requestId ?: JSONObject.NULL)
                    })

                    notifyListeners("ended", JSObject().apply {
                        put("requestId", requestId ?: JSONObject.NULL)
                        put("reason", "finished")
                    })
                    emitPlaybackState("ended", requestId)
                }
            }
            Player.STATE_IDLE -> {
                notifyListeners("bufferingChanged", JSObject().apply {
                    put("isBuffering", false)
                    put("requestId", requestId ?: JSONObject.NULL)
                })
            }
        }
    }

    private fun handleIsPlayingChanged(isPlaying: Boolean) {
        val requestId = currentRequestId
        if (isPlaying) {
            startProgressUpdates()
            emitPlaybackState("playing", requestId)
        } else {
            stopProgressUpdates()
            val player = playbackService?.getPlayer()
            if (player != null) {
                if (player.playbackState != Player.STATE_ENDED && player.playbackState != Player.STATE_IDLE) {
                    emitPlaybackState("paused", requestId)
                }
            }
        }
    }

    private fun handlePlayerError(error: PlaybackException) {
        val requestId = currentRequestId
        notifyListeners("bufferingChanged", JSObject().apply {
            put("isBuffering", false)
            put("requestId", requestId ?: JSONObject.NULL)
        })

        notifyListeners("error", JSObject().apply {
            put("code", "playback_failed")
            put("message", error.localizedMessage ?: "Unknown ExoPlayer error")
            put("requestId", requestId ?: JSONObject.NULL)
        })
        emitPlaybackState("failed", requestId)
    }

    private val progressRunnable = object : Runnable {
        override fun run() {
            emitProgress()
            mainHandler.postDelayed(this, 500)
        }
    }

    private fun startProgressUpdates() {
        mainHandler.removeCallbacks(progressRunnable)
        mainHandler.post(progressRunnable)
    }

    private fun stopProgressUpdates() {
        mainHandler.removeCallbacks(progressRunnable)
    }

    private fun emitProgress() {
        val player = playbackService?.getPlayer() ?: return
        val duration = player.duration
        val currentPosition = player.currentPosition
        val bufferedPosition = player.bufferedPosition

        val data = JSObject().apply {
            put("currentTime", currentPosition / 1000.0)
            put("duration", if (duration == C.TIME_UNSET) 0.0 else duration / 1000.0)
            put("bufferedTime", bufferedPosition / 1000.0)
            put("requestId", currentRequestId ?: JSONObject.NULL)
        }
        notifyListeners("progress", data)

        // Also sync progress down to persistence
        playbackService?.persistence?.updateProgress(currentPosition / 1000.0)
    }

    private fun emitPlaybackState(state: String, requestId: String?) {
        val data = JSObject().apply {
            put("state", state)
            put("requestId", requestId ?: JSONObject.NULL)
        }
        notifyListeners("playbackStateChanged", data)
    }

    private fun emitRemoteCommand(command: String, position: Double? = null) {
        val data = JSObject().apply {
            put("command", command)
            if (position != null) {
                put("position", position)
            }
            put("requestId", currentRequestId ?: JSONObject.NULL)
        }
        notifyListeners("remoteCommand", data)
    }

    private fun checkAndRequestNotificationPermission(call: PluginCall, onDone: () -> Unit) {
        if (Build.VERSION.SDK_INT >= 33) { // Android 13+ (Tiramisu)
            if (getPermissionState("post_notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("post_notifications", call, "notificationPermissionCallback")
                return
            }
        }
        onDone()
    }

    @PermissionCallback
    fun notificationPermissionCallback(call: PluginCall) {
        // Regardless of granted/denied status, we proceed with the command
        when (call.methodName) {
            "play" -> executePlay(call)
            "load" -> executeLoad(call)
        }
    }

    @PluginMethod
    fun load(call: PluginCall) {
        val service = playbackService
        if (service != null && service.isQueueEngineActive) {
            call.resolve()
            return
        }
        checkAndRequestNotificationPermission(call) {
            executeLoad(call)
        }
    }

    private fun executeLoad(call: PluginCall) {
        val sourceObj = call.getObject("source") ?: run {
            call.reject("Missing audio source.")
            return
        }

        val parsedSource = NativeAudioSourceParser.parseSource(sourceObj) ?: run {
            call.reject("Failed to parse audio source.")
            return
        }

        val parsedMetadata = NativeAudioSourceParser.parseMetadata(call.getObject("metadata"))
        val autoplay = call.getBoolean("autoplay", false) ?: false
        val startTime = call.getDouble("startTime", 0.0) ?: 0.0
        val requestId = call.getString("requestId")

        currentRequestId = requestId

        val url = parsedSource.url ?: parsedSource.uri
        if (url.isNullOrEmpty()) {
            call.reject("Missing audio source URL or URI")
            return
        }

        val mediaMetadataBuilder = MediaMetadata.Builder()
        parsedMetadata?.let {
            mediaMetadataBuilder.setTitle(it.title)
            mediaMetadataBuilder.setArtist(it.artist)
            mediaMetadataBuilder.setAlbumTitle(it.album)
            it.artworkUrl?.let { artUrl ->
                mediaMetadataBuilder.setArtworkUri(Uri.parse(artUrl))
            }
        }

        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(url))
            .setMediaMetadata(mediaMetadataBuilder.build())
            .build()

        mainHandler.post {
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(mediaItem)
            player.prepare()
            if (startTime > 0.0) {
                player.seekTo((startTime * 1000).toLong())
            }
            emitPlaybackState("loading", requestId)
            if (autoplay) {
                player.play()
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        checkAndRequestNotificationPermission(call) {
            executePlay(call)
        }
    }

    private fun executePlay(call: PluginCall) {
        mainHandler.post {
            val service = playbackService ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            val player = service.getPlayer() ?: run {
                call.reject("ExoPlayer is not ready")
                return@post
            }

            service.savedRestoreTime = null
            service.queueEngine.clearRestoredFlag()

            player.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        mainHandler.post {
            val service = playbackService ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            val player = service.getPlayer() ?: run {
                call.reject("ExoPlayer is not ready")
                return@post
            }
            player.pause()
            service.persistence.flushNow()
            call.resolve()
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        mainHandler.post {
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            player.pause()
            player.seekTo(0)
            emitPlaybackState("stopped", currentRequestId)
            call.resolve()
        }
    }

    @PluginMethod
    fun seek(call: PluginCall) {
        val position = call.getDouble("position") ?: run {
            call.reject("Missing position parameter")
            return
        }
        mainHandler.post {
            val service = playbackService ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            val player = service.getPlayer() ?: run {
                call.reject("ExoPlayer is not ready")
                return@post
            }
            player.seekTo((position * 1000).toLong())
            service.persistence.updateProgress(position)
            service.persistence.flushNow()
            call.resolve()
        }
    }

    @PluginMethod
    fun updateMetadata(call: PluginCall) {
        val title = call.getString("title")
        val artist = call.getString("artist")
        val album = call.getString("album")
        val artworkUrl = call.getString("artworkUrl")

        mainHandler.post {
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            val currentItem = player.currentMediaItem
            if (currentItem != null) {
                val updatedMetadata = currentItem.mediaMetadata.buildUpon()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album)
                if (artworkUrl != null) {
                    updatedMetadata.setArtworkUri(Uri.parse(artworkUrl))
                }
                val updatedItem = currentItem.buildUpon()
                    .setMediaMetadata(updatedMetadata.build())
                    .build()
                player.replaceMediaItem(player.currentMediaItemIndex, updatedItem)
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        mainHandler.post {
            val service = playbackService
            val player = service?.getPlayer() ?: run {
                call.resolve()
                return@post
            }
            player.stop()
            player.clearMediaItems()
            emitPlaybackState("idle", currentRequestId)
            currentRequestId = null

            service.clearQueueState()

            call.resolve()
        }
    }

    private fun deleteCachedAudioFileInternal(songId: String): Boolean {
        val cacheId = AudioCacheUtils.cacheId(songId)
        var deleted = false
        val cacheDirs = listOf(
            AudioCacheDirectoryHelper.getCacheDir(context),
            AudioCacheDirectoryHelper.getSecCacheDir(context)
        )
        for (dir in cacheDirs) {
            if (dir.exists() && dir.isDirectory) {
                val files = dir.listFiles()
                if (files != null) {
                    for (file in files) {
                        if (file.name.startsWith("$cacheId.")) {
                            if (file.delete()) {
                                deleted = true
                            }
                        }
                    }
                }
            }
        }
        return deleted
    }

    private fun resolveCachedAudioFileInternal(songId: String): JSObject? {
        val cacheId = AudioCacheUtils.cacheId(songId)
        val cacheDirs = listOf(
            AudioCacheDirectoryHelper.getCacheDir(context),
            AudioCacheDirectoryHelper.getSecCacheDir(context)
        )

        for (dir in cacheDirs) {
            if (!dir.exists() || !dir.isDirectory) continue
            val metadataFile = File(dir, "$cacheId.json")
            if (metadataFile.exists()) {
                try {
                    val json = JSONObject(metadataFile.readText(Charsets.UTF_8))
                    val fileName = json.getString("fileName")
                    val contentType = json.getString("contentType")
                    val lastModifiedAt = json.getDouble("lastModifiedAt")

                    val audioFile = File(dir, fileName)
                    if (audioFile.exists()) {
                        return JSObject().apply {
                            put("songId", songId)
                            put("uri", Uri.fromFile(audioFile).toString())
                            put("contentType", contentType)
                            put("sizeBytes", audioFile.length())
                            put("lastModifiedAt", lastModifiedAt)
                        }
                    }
                } catch (_: Exception) {
                    // Metadata corrupt? Fallback to directory scan
                }
            }

            // Fallback: search directory for any file starting with cacheId. but not ending with .json
            val files = dir.listFiles()
            if (files != null) {
                for (file in files) {
                    if (file.name.startsWith("$cacheId.") && !file.name.endsWith(".json")) {
                        return JSObject().apply {
                            put("songId", songId)
                            put("uri", Uri.fromFile(file).toString())
                            put("contentType", "audio/mpeg") // fallback content type
                            put("sizeBytes", file.length())
                            put("lastModifiedAt", file.lastModified().toDouble())
                        }
                    }
                }
            }
        }
        return null
    }

    // Helper object to avoid repeated reflection lookups inside resolver loops
    private object AudioCacheDirectoryHelper {
        fun getCacheDir(context: Context) = AudioCacheUtils.getCacheDirectory(context)
        fun getSecCacheDir(context: Context) = AudioCacheUtils.getSecondaryCacheDirectory(context)
    }

    @PluginMethod
    fun resolveAudioFile(call: PluginCall) {
        val songId = call.getString("songId") ?: run {
            call.reject("Missing songId")
            return
        }

        pluginScope.launch(Dispatchers.IO) {
            try {
                val file = resolveCachedAudioFileInternal(songId)
                val response = JSObject().apply {
                    if (file != null) {
                        put("file", file)
                    } else {
                        put("file", JSONObject.NULL)
                    }
                }
                call.resolve(response)
            } catch (e: Exception) {
                call.reject("Failed to resolve audio file: ${e.localizedMessage}")
            }
        }
    }

    @PluginMethod
    fun getAudioFileSize(call: PluginCall) {
        val songId = call.getString("songId") ?: run {
            call.reject("Missing songId")
            return
        }

        pluginScope.launch(Dispatchers.IO) {
            val file = resolveCachedAudioFileInternal(songId)
            val response = JSObject().apply {
                if (file != null) {
                    put("sizeBytes", file.getLong("sizeBytes"))
                } else {
                    put("sizeBytes", JSONObject.NULL)
                }
            }
            call.resolve(response)
        }
    }

    @PluginMethod
    fun deleteAudioFile(call: PluginCall) {
        val songId = call.getString("songId") ?: run {
            call.reject("Missing songId")
            return
        }

        pluginScope.launch(Dispatchers.IO) {
            val deleted = deleteCachedAudioFileInternal(songId)
            val response = JSObject().apply {
                put("deleted", deleted)
            }
            call.resolve(response)
        }
    }

    @PluginMethod
    fun clearAudioFiles(call: PluginCall) {
        pluginScope.launch(Dispatchers.IO) {
            var count = 0
            val cacheDirs = listOf(
                AudioCacheDirectoryHelper.getCacheDir(context),
                AudioCacheDirectoryHelper.getSecCacheDir(context)
            )
            for (dir in cacheDirs) {
                if (dir.exists() && dir.isDirectory) {
                    val files = dir.listFiles()
                    if (files != null) {
                        for (file in files) {
                            if (file.delete()) {
                                count++
                            }
                        }
                    }
                }
            }
            val response = JSObject().apply {
                put("deletedCount", count)
            }
            call.resolve(response)
        }
    }

    // Volume HUD Stub
    @PluginMethod
    fun setVolumeHUDEnabled(call: PluginCall) {
        call.resolve()
    }

    // Queue Engine Methods

    @PluginMethod
    fun setContextQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }

        val songsArray = call.getArray("songs") ?: run {
            call.reject("Missing songs parameter")
            return
        }
        val songs = mutableListOf<QueueSong>()
        for (i in 0 until songsArray.length()) {
            songs.add(QueueSong.from(songsArray.getJSONObject(i)))
        }

        val currentIndex = call.getInt("currentIndex") ?: 0
        val autoplay = call.getBoolean("autoplay", true) ?: true
        val startTime = call.getDouble("startTime")

        var sourceId: QueueSourceId? = null
        val srcObj = call.getObject("sourceId")
        if (srcObj != null) {
            sourceId = QueueSourceId.from(srcObj)
        }
        val sourceName = call.getString("sourceName")

        val repeatMode = call.getString("repeatMode")

        mainHandler.post {
            repeatMode?.let { service.setRepeatMode(it) }
            service.setContextQueue(songs, currentIndex, autoplay, startTime, sourceId, sourceName)
            call.resolve()
        }
    }

    @PluginMethod
    fun updateContextQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val songsArray = call.getArray("songs") ?: run {
            call.reject("Missing songs parameter")
            return
        }
        val songs = mutableListOf<QueueSong>()
        for (i in 0 until songsArray.length()) {
            songs.add(QueueSong.from(songsArray.getJSONObject(i)))
        }
        val currentIndex = call.getInt("currentIndex") ?: 0

        mainHandler.post {
            service.updateContextQueue(songs, currentIndex)
            call.resolve()
        }
    }

    @PluginMethod
    fun reorderContextQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val fromIndex = call.getInt("fromIndex") ?: 0
        val toIndex = call.getInt("toIndex") ?: 0

        mainHandler.post {
            service.reorderContextQueue(fromIndex, toIndex)
            call.resolve()
        }
    }

    @PluginMethod
    fun addToUserQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val songsArray = call.getArray("songs") ?: run {
            call.reject("Missing songs parameter")
            return
        }
        val songs = mutableListOf<QueueSong>()
        for (i in 0 until songsArray.length()) {
            songs.add(QueueSong.from(songsArray.getJSONObject(i)))
        }
        val position = call.getString("position") ?: "last"

        mainHandler.post {
            service.addToUserQueue(songs, position)
            call.resolve()
        }
    }

    @PluginMethod
    fun removeFromUserQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val indicesArray = call.getArray("indices") ?: run {
            call.reject("Missing indices parameter")
            return
        }
        val indices = mutableListOf<Int>()
        for (i in 0 until indicesArray.length()) {
            indices.add(indicesArray.getInt(i))
        }

        mainHandler.post {
            service.removeFromUserQueue(indices)
            call.resolve()
        }
    }

    @PluginMethod
    fun clearUserQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        mainHandler.post {
            service.clearUserQueue()
            call.resolve()
        }
    }

    @PluginMethod
    fun playAtIndex(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val index = call.getInt("index") ?: 0
        val startTime = call.getDouble("startTime")

        mainHandler.post {
            service.playAtIndex(index, startTime)
            call.resolve()
        }
    }

    @PluginMethod
    fun getFullState(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        mainHandler.post {
            val player = service.getPlayer()
            val currentTime = if (player != null) player.currentPosition / 1000.0 else 0.0
            val duration = if (player != null && player.duration != C.TIME_UNSET) player.duration / 1000.0 else 0.0
            val isPlaying = if (player != null) player.isPlaying else false

            val fullState = service.queueEngine.getFullState(currentTime, duration, isPlaying)
            val jsObj = JSObject.fromJSONObject(fullState)
            call.resolve(jsObj)
        }
    }

    @PluginMethod
    fun setRepeatMode(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val mode = call.getString("mode") ?: "off"
        mainHandler.post {
            service.setRepeatMode(mode)
            call.resolve()
        }
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val enabled = call.getBoolean("enabled") ?: false
        mainHandler.post {
            service.setShuffle(enabled)
            call.resolve()
        }
    }

    @PluginMethod
    fun markAsShuffled(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        val songsArray = call.getArray("originalSongs") ?: run {
            call.reject("Missing originalSongs parameter")
            return
        }
        val songs = mutableListOf<QueueSong>()
        for (i in 0 until songsArray.length()) {
            songs.add(QueueSong.from(songsArray.getJSONObject(i)))
        }

        mainHandler.post {
            service.markAsShuffled(songs)
            call.resolve()
        }
    }

    @PluginMethod
    fun skipToNext(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        mainHandler.post {
            if (service.isQueueEngineActive) {
                service.queueEngine.skipToNext()
            } else {
                emitRemoteCommand("next")
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun skipToPrevious(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }
        mainHandler.post {
            if (service.isQueueEngineActive) {
                val player = service.getPlayer()
                val currentTime = if (player != null) player.currentPosition / 1000.0 else 0.0
                service.queueEngine.skipToPrevious(currentTime)
            } else {
                emitRemoteCommand("previous")
            }
            call.resolve()
        }
    }

    // Other non-A2/A3 methods return UNIMPLEMENTED

    @PluginMethod
    fun preload(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "preload")
    }

    @PluginMethod
    fun storeAudioFile(call: PluginCall) {
        val songId = call.getString("songId") ?: run {
            call.reject("Missing songId")
            return
        }
        val dataBase64 = call.getString("dataBase64") ?: run {
            call.reject("Missing dataBase64")
            return
        }
        val contentType = call.getString("contentType") ?: "audio/mpeg"

        pluginScope.launch(Dispatchers.IO) {
            try {
                val data = android.util.Base64.decode(dataBase64, android.util.Base64.DEFAULT)
                val cacheDir = AudioCacheUtils.getCacheDirectory(context, createIfNeeded = true)

                // Delete existing first to ensure atomic updates
                deleteCachedAudioFileInternal(songId)

                val ext = AudioCacheUtils.fileExtension(contentType)
                val cacheId = AudioCacheUtils.cacheId(songId)
                val destFile = File(cacheDir, "$cacheId.$ext")
                destFile.writeBytes(data)

                val metadataFile = AudioCacheUtils.getMetadataFile(context, songId)
                val metadataJson = JSONObject().apply {
                    put("songId", songId)
                    put("fileName", destFile.name)
                    put("contentType", contentType)
                    put("lastModifiedAt", System.currentTimeMillis().toDouble())
                }
                metadataFile.writeText(metadataJson.toString(), Charsets.UTF_8)

                val response = JSObject().apply {
                    put("songId", songId)
                    put("uri", Uri.fromFile(destFile).toString())
                    put("contentType", contentType)
                    put("sizeBytes", destFile.length())
                    put("lastModifiedAt", metadataJson.getDouble("lastModifiedAt"))
                }
                call.resolve(response)
            } catch (e: Exception) {
                call.reject("Failed to store audio file: ${e.localizedMessage}")
            }
        }
    }

    @PluginMethod
    fun downloadAudioFile(call: PluginCall) {
        val songId = call.getString("songId") ?: run {
            call.reject("Missing songId")
            return
        }
        val maxBitRate = call.getInt("maxBitRate")
        val format = call.getString("format")

        val service = playbackService ?: run {
            call.reject("Playback service not ready")
            return
        }

        service.downloadManager.download(songId, maxBitRate, format)
        call.resolve()
    }

    @PluginMethod
    fun cancelDownload(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service not ready")
            return
        }

        val songId = call.getString("songId")
        if (songId != null) {
            service.downloadManager.cancel(songId)
        } else {
            service.downloadManager.cancelAll()
        }
        call.resolve()
    }

    @PluginMethod
    fun setSystemVolume(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setSystemVolume")
    }

    @PluginMethod
    fun getSystemVolume(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getSystemVolume")
    }

    @PluginMethod
    fun getScrobbleBuffer(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getScrobbleBuffer")
    }

    @PluginMethod
    fun clearScrobbleBuffer(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearScrobbleBuffer")
    }

    @PluginMethod
    fun resolveSongs(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "resolveSongs")
    }

    @PluginMethod
    fun setLikeActive(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setLikeActive")
    }

    @PluginMethod
    fun setSleepTimer(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setSleepTimer")
    }

    @PluginMethod
    fun cancelSleepTimer(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "cancelSleepTimer")
    }

    @PluginMethod
    fun getSleepTimerRemaining(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getSleepTimerRemaining")
    }
}
