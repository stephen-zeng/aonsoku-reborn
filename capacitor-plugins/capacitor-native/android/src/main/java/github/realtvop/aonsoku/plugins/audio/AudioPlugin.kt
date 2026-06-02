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
import org.json.JSONObject

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

    private val serviceListener = object : PlaybackService.Listener {
        override fun onRemoteCommand(command: String, position: Double?) {
            emitRemoteCommand(command, position)
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? PlaybackService.LocalBinder
            val currentService = binder?.getService()
            playbackService = currentService
            isBound = true

            currentService?.addListener(serviceListener)
            setupPlayerListener()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playbackService?.removeListener(serviceListener)
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
        if (isBound) {
            context.unbindService(connection)
            isBound = false
        }
        mainHandler.removeCallbacks(progressRunnable)
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
                notifyListeners("bufferingChanged", JSObject().apply {
                    put("isBuffering", false)
                    put("requestId", requestId ?: JSONObject.NULL)
                })

                notifyListeners("ended", JSObject().apply {
                    put("requestId", requestId ?: JSONObject.NULL)
                })
                emitPlaybackState("ended", requestId)
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
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            player.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        mainHandler.post {
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            player.pause()
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
            player.stop()
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
            val player = playbackService?.getPlayer() ?: run {
                call.reject("Playback service is not ready")
                return@post
            }
            player.seekTo((position * 1000).toLong())
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
            val player = playbackService?.getPlayer() ?: run {
                call.resolve()
                return@post
            }
            player.stop()
            player.clearMediaItems()
            emitPlaybackState("idle", currentRequestId)
            currentRequestId = null
            call.resolve()
        }
    }

    // Safe stubs for caching capabilities (A4)
    @PluginMethod
    fun resolveAudioFile(call: PluginCall) {
        val response = JSObject().apply {
            put("file", JSONObject.NULL)
        }
        call.resolve(response)
    }

    @PluginMethod
    fun getAudioFileSize(call: PluginCall) {
        val response = JSObject().apply {
            put("sizeBytes", JSONObject.NULL)
        }
        call.resolve(response)
    }

    @PluginMethod
    fun deleteAudioFile(call: PluginCall) {
        val response = JSObject().apply {
            put("deleted", false)
        }
        call.resolve(response)
    }

    @PluginMethod
    fun clearAudioFiles(call: PluginCall) {
        val response = JSObject().apply {
            put("deletedCount", 0)
        }
        call.resolve(response)
    }

    // Volume HUD Stub
    @PluginMethod
    fun setVolumeHUDEnabled(call: PluginCall) {
        call.resolve()
    }

    // Other non-A2 methods return UNIMPLEMENTED
    @PluginMethod
    fun setRepeatMode(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setRepeatMode")
    }

    @PluginMethod
    fun setShuffle(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setShuffle")
    }

    @PluginMethod
    fun setQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setQueue")
    }

    @PluginMethod
    fun skipToNext(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "skipToNext")
    }

    @PluginMethod
    fun skipToPrevious(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "skipToPrevious")
    }

    @PluginMethod
    fun preload(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "preload")
    }

    @PluginMethod
    fun storeAudioFile(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "storeAudioFile")
    }

    @PluginMethod
    fun setContextQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setContextQueue")
    }

    @PluginMethod
    fun addToUserQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "addToUserQueue")
    }

    @PluginMethod
    fun removeFromUserQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "removeFromUserQueue")
    }

    @PluginMethod
    fun clearUserQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearUserQueue")
    }

    @PluginMethod
    fun playAtIndex(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "playAtIndex")
    }

    @PluginMethod
    fun getFullState(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getFullState")
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
    fun downloadAudioFile(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "downloadAudioFile")
    }

    @PluginMethod
    fun cancelDownload(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "cancelDownload")
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
    fun updateContextQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "updateContextQueue")
    }

    @PluginMethod
    fun reorderContextQueue(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "reorderContextQueue")
    }

    @PluginMethod
    fun markAsShuffled(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "markAsShuffled")
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
