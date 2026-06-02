package github.realtvop.aonsoku.plugins.audio

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.media.AudioManager
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
import github.realtvop.aonsoku.plugins.bridge.AndroidCredentialStore
import github.realtvop.aonsoku.plugins.bridge.ServerCredentials
import github.realtvop.aonsoku.plugins.bridge.SubsonicHttpClient
import github.realtvop.aonsoku.plugins.debug.NativeLogger
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

    private val pendingServiceCalls = mutableListOf<PluginCall>()
    private val serviceReadyTimeoutMs = 5000L

    private val httpClient = SubsonicHttpClient()
    private val credentialStore: AndroidCredentialStore by lazy {
        AndroidCredentialStore(context)
    }
    private val scrobbleBuffer by lazy {
        NativeScrobbleBuffer(ScrobbleFileStore(context))
    }
    private val scrobbleSubmitter = NativeScrobbleSubmitter(httpClient)

    private var currentScrobbleSongId: String? = null
    private var currentScrobbleSongDuration: Double = 0.0

    private var sleepTimerHandler: Handler? = null
    private var sleepTimerEndTime: Long = 0
    private var sleepTimerMode: String = "duration"

    private var audioManager: AudioManager? = null
    private var audioFocusChangeListener: AudioManager.OnAudioFocusChangeListener? = null
    private var wasPlayingBeforeFocusLoss: Boolean = false
    private var headphoneReceiver: HeadphoneUnplugReceiver? = null

    private inner class HeadphoneUnplugReceiver : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                notifyListeners("routeChanged", JSObject().apply {
                    put("requestId", currentRequestId ?: JSONObject.NULL)
                    put("reason", "headphone_unplugged")
                })
            }
        }
    }

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
            handleScrobbleSongEnded()
            handleScrobbleSongStarted(songId, currentScrobbleSongDuration)
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
            if (state == "playing" && currentScrobbleSongId != null) {
                scrobbleBuffer.resumeTracking()
            } else if (state == "paused" && currentScrobbleSongId != null) {
                scrobbleBuffer.pauseTracking()
            }
            emitPlaybackState(state, currentRequestId)
        }

        override fun onEnded(reason: String) {
            notifyListeners("ended", JSObject().apply {
                put("requestId", currentRequestId ?: JSONObject.NULL)
                put("reason", reason)
            })
            emitPlaybackState("ended", currentRequestId)
            if (reason == "finished") {
                handleScrobbleSongEnded()
            }
        }

        override fun onSleepTimerEndOfTrack() {
            fireSleepTimerEvent("endOfTrack")
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? PlaybackService.LocalBinder
            val currentService = binder?.getService()
            playbackService = currentService
            isBound = true
            NativeLogger.info("PlaybackService connected", "audio-plugin")

            currentService?.addListener(serviceListener)
            currentService?.addDownloadListener(downloadListener)
            setupPlayerListener()
            drainPendingServiceCalls()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            NativeLogger.warn("PlaybackService disconnected", "audio-plugin")
            playbackService?.removeListener(serviceListener)
            playbackService?.removeDownloadListener(downloadListener)
            playbackService = null
            isBound = false
        }
    }

    override fun load() {
        super.load()
        NativeLogger.info("AudioPlugin loaded, binding PlaybackService", "audio-plugin")
        bindPlaybackService()
        registerAudioFocusListener()
        registerHeadphoneReceiver()
    }

    override fun handleOnDestroy() {
        playbackService?.removeListener(serviceListener)
        playbackService?.removeDownloadListener(downloadListener)
        if (isBound) {
            context.unbindService(connection)
            isBound = false
        }
        mainHandler.removeCallbacks(progressRunnable)
        cancelSleepTimerInternal()
        unregisterAudioFocusListener()
        unregisterHeadphoneReceiver()
        for (call in pendingServiceCalls) {
            call.reject("Plugin destroyed")
        }
        pendingServiceCalls.clear()
        pluginScope.cancel()
        super.handleOnDestroy()
    }

    private fun bindPlaybackService() {
        val intent = Intent(context, PlaybackService::class.java)
        try {
            context.startService(intent)
        } catch (_: Exception) {
        }
        context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    private fun requireServiceOrQueue(call: PluginCall): Boolean {
        if (playbackService != null) return false
        pendingServiceCalls.add(call)
        mainHandler.postDelayed({
            if (pendingServiceCalls.remove(call)) {
                NativeLogger.error("Service-ready timeout for call: ${call.methodName}", "audio-plugin")
                call.reject("Playback service is not ready")
            }
        }, serviceReadyTimeoutMs)
        return true
    }

    private fun drainPendingServiceCalls() {
        val calls = pendingServiceCalls.toList()
        pendingServiceCalls.clear()
        for (call in calls) {
            routePendingCall(call)
        }
    }

    private fun routePendingCall(call: PluginCall) {
        try {
            when (call.methodName) {
                "load" -> executeLoad(call)
                "play" -> executePlay(call)
                "pause" -> executePause(call)
                "seek" -> executeSeek(call)
                "clear" -> executeClear(call)
                "setContextQueue" -> executeSetContextQueue(call)
                "updateContextQueue" -> executeUpdateContextQueue(call)
                "reorderContextQueue" -> executeReorderContextQueue(call)
                "addToUserQueue" -> executeAddToUserQueue(call)
                "removeFromUserQueue" -> executeRemoveFromUserQueue(call)
                "clearUserQueue" -> executeClearUserQueue(call)
                "playAtIndex" -> executePlayAtIndex(call)
                "getFullState" -> executeGetFullState(call)
                "setRepeatMode" -> executeSetRepeatMode(call)
                "setShuffle" -> executeSetShuffle(call)
                "stop" -> executeStop(call)
                "updateMetadata" -> executeUpdateMetadata(call)
                "skipToNext" -> executeSkipToNext(call)
                "skipToPrevious" -> executeSkipToPrevious(call)
                "markAsShuffled" -> executeMarkAsShuffled(call)
                else -> call.reject("Unknown method: ${call.methodName}")
            }
        } catch (e: Exception) {
            NativeLogger.error("Error replaying pending call ${call.methodName}: ${e.message}", "audio-plugin")
            call.reject("Failed to execute ${call.methodName}: ${e.message}")
        }
    }

    // MARK: - Audio Focus

    private fun registerAudioFocusListener() {
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        if (audioManager == null) return

        audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
            handleAudioFocusChange(focusChange)
        }
    }

    private fun unregisterAudioFocusListener() {
        audioFocusChangeListener?.let {
            audioManager?.abandonAudioFocus(it)
        }
        audioFocusChangeListener = null
    }

    private fun requestAudioFocus(): Int {
        val am = audioManager ?: return AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        val listener = audioFocusChangeListener ?: return AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        return am.requestAudioFocus(
            listener,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN,
        )
    }

    private fun abandonAudioFocus() {
        val am = audioManager ?: return
        val listener = audioFocusChangeListener ?: return
        am.abandonAudioFocus(listener)
    }

    private fun handleAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_GAIN -> {
                notifyListeners("interruptionChanged", JSObject().apply {
                    put("requestId", currentRequestId ?: JSONObject.NULL)
                    put("type", "ended")
                    put("shouldResume", wasPlayingBeforeFocusLoss)
                })
                wasPlayingBeforeFocusLoss = false
            }
            AudioManager.AUDIOFOCUS_LOSS -> {
                val player = playbackService?.getPlayer()
                wasPlayingBeforeFocusLoss = player?.isPlaying == true
                player?.pause()
                notifyListeners("interruptionChanged", JSObject().apply {
                    put("requestId", currentRequestId ?: JSONObject.NULL)
                    put("type", "began")
                })
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                val player = playbackService?.getPlayer()
                wasPlayingBeforeFocusLoss = player?.isPlaying == true
                player?.pause()
                notifyListeners("interruptionChanged", JSObject().apply {
                    put("requestId", currentRequestId ?: JSONObject.NULL)
                    put("type", "began")
                })
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                notifyListeners("interruptionChanged", JSObject().apply {
                    put("requestId", currentRequestId ?: JSONObject.NULL)
                    put("type", "began")
                    put("canDuck", true)
                })
            }
        }
    }

    // MARK: - Headphone Route Receiver

    private fun registerHeadphoneReceiver() {
        val receiver = HeadphoneUnplugReceiver()
        headphoneReceiver = receiver
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(receiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(receiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
        }
    }

    private fun unregisterHeadphoneReceiver() {
        headphoneReceiver?.let { receiver ->
            try {
                context.unregisterReceiver(receiver)
            } catch (_: Exception) {
            }
        }
        headphoneReceiver = null
    }

    // MARK: - Scrobble

    private fun handleScrobbleSongEnded() {
        val entry = scrobbleBuffer.stopTracking()
        if (entry != null) {
            notifyListeners("scrobbleEvent", JSObject().apply {
                put("songId", entry.songId)
                put("playedDurationMs", entry.playedDurationMs)
                put("timestamp", entry.timestamp)
            })
            val credentials = credentialStore.retrieve()
            if (credentials != null) {
                scrobbleSubmitter.submitIfEligible(entry, currentScrobbleSongDuration, credentials)
            }
        }
        currentScrobbleSongId = null
    }

    private fun handleScrobbleSongStarted(songId: String, duration: Double) {
        currentScrobbleSongId = songId
        currentScrobbleSongDuration = duration
        scrobbleBuffer.startTracking(songId, duration)
        val credentials = credentialStore.retrieve()
        if (credentials != null) {
            pluginScope.launch {
                scrobbleSubmitter.sendNowPlaying(songId, credentials)
            }
        }
    }

    // MARK: - Sleep Timer

    @PluginMethod
    fun setSleepTimer(call: PluginCall) {
        val seconds = call.getDouble("seconds") ?: 0.0
        val mode = call.getString("mode") ?: "duration"

        cancelSleepTimerInternal()
        playbackService?.sleepTimerMode = mode

        if (mode == "duration" && seconds > 0) {
            sleepTimerEndTime = System.currentTimeMillis() + (seconds * 1000).toLong()
            sleepTimerMode = mode
            val handler = Handler(Looper.getMainLooper())
            sleepTimerHandler = handler
            handler.postDelayed({
                fireSleepTimer()
            }, (seconds * 1000).toLong())
        }
        call.resolve()
    }

    @PluginMethod
    fun cancelSleepTimer(call: PluginCall) {
        cancelSleepTimerInternal()
        playbackService?.sleepTimerMode = "duration"
        call.resolve()
    }

    @PluginMethod
    fun getSleepTimerRemaining(call: PluginCall) {
        val remaining = if (sleepTimerEndTime > 0) {
            maxOf(0, sleepTimerEndTime - System.currentTimeMillis()) / 1000
        } else 0
        call.resolve(JSObject().apply {
            put("remainingSeconds", remaining.toDouble())
        })
    }

    private fun cancelSleepTimerInternal() {
        sleepTimerHandler?.removeCallbacksAndMessages(null)
        sleepTimerHandler = null
        sleepTimerEndTime = 0
        sleepTimerMode = "duration"
    }

    private fun fireSleepTimer() {
        playbackService?.getPlayer()?.let { player ->
            player.pause()
        }
        playbackService?.persistence?.flushNow()
        cancelSleepTimerInternal()
        playbackService?.sleepTimerMode = "duration"
        fireSleepTimerEvent("duration")
    }

    private fun fireSleepTimerEvent(reason: String) {
        emitPlaybackState("paused", currentRequestId)
        notifyListeners("sleepTimerFired", JSObject().apply {
            put("reason", reason)
        })
    }

    // MARK: - Player Listener

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
                emitPlaybackState("idle", requestId)
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

            val mappedCode = mapPlayerErrorCode(error)
        NativeLogger.error("Player error: ${mappedCode} - ${error.localizedMessage}", "audio-plugin")
        notifyListeners("error", JSObject().apply {
            put("code", mappedCode)
            put("message", error.localizedMessage ?: "Unknown ExoPlayer error")
            put("requestId", requestId ?: JSONObject.NULL)
        })
        emitPlaybackState("failed", requestId)
    }

    private fun mapPlayerErrorCode(error: PlaybackException): String {
        return when (error.errorCode) {
            PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW,
            PlaybackException.ERROR_CODE_TIMEOUT,
            PlaybackException.ERROR_CODE_IO_UNSPECIFIED -> "network_error"
            PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
            PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
            PlaybackException.ERROR_CODE_DECODING_FAILED,
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED -> "invalid_media"
            PlaybackException.ERROR_CODE_DRM_UNSPECIFIED,
            PlaybackException.ERROR_CODE_DRM_SCHEME_UNSUPPORTED,
            PlaybackException.ERROR_CODE_DRM_PROVISIONING_FAILED,
            PlaybackException.ERROR_CODE_DRM_CONTENT_ERROR,
            PlaybackException.ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED,
            PlaybackException.ERROR_CODE_DRM_DISALLOWED_OPERATION -> "drm_error"
            PlaybackException.ERROR_CODE_REMOTE_ERROR -> "remote_error"
            else -> "playback_failed"
        }
    }

    // MARK: - Progress

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
        if (Build.VERSION.SDK_INT >= 33) {
            if (getPermissionState("post_notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("post_notifications", call, "notificationPermissionCallback")
                return
            }
        }
        onDone()
    }

    @PermissionCallback
    fun notificationPermissionCallback(call: PluginCall) {
        when (call.methodName) {
            "play" -> executePlay(call)
            "load" -> executeLoad(call)
        }
    }

    // MARK: - Plugin Methods

    @PluginMethod
    fun load(call: PluginCall) {
        mainHandler.post {
            val service = playbackService
            if (service != null && service.isQueueEngineActive) {
                val player = service.getPlayer()
                if (player != null && player.mediaItemCount > 0) {
                    call.resolve()
                    return@post
                }
            }
            if (requireServiceOrQueue(call)) return@post
            checkAndRequestNotificationPermission(call) {
                executeLoad(call)
            }
        }
    }

    private fun executeLoad(call: PluginCall) {
        NativeLogger.debug("Loading audio source", "audio-plugin")
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

        handleScrobbleSongEnded()

        val rawUrl = parsedSource.url ?: parsedSource.uri
        if (rawUrl.isNullOrEmpty()) {
            call.reject("Missing audio source URL or URI")
            return
        }

        val resolver = NativeSourceResolver(context)
        val tempSong = QueueSong(
            id = parsedSource.songId ?: "",
            title = parsedMetadata?.title ?: "",
            artist = parsedMetadata?.artist ?: "",
            artistId = null,
            album = parsedMetadata?.album ?: "",
            albumId = null,
            duration = parsedMetadata?.duration ?: 0.0,
            coverArtId = null,
            streamUrl = rawUrl,
            cachedFileUri = parsedSource.uri
        )
        val resolved = resolver.resolveSource(tempSong)

        if (resolved == null && (rawUrl.startsWith("aonsoku-media://") || rawUrl.isNullOrEmpty())) {
            NativeLogger.error("Cannot resolve source for song ${parsedSource.songId}: missing credentials or unresolvable stream URL", "audio-plugin")
            call.reject("Cannot resolve source: missing credentials or unresolvable stream URL")
            return
        }

        val url = resolved?.first ?: rawUrl

        val mediaMetadataBuilder = MediaMetadata.Builder()
        parsedMetadata?.let {
            mediaMetadataBuilder.setTitle(it.title)
            mediaMetadataBuilder.setArtist(it.artist)
            mediaMetadataBuilder.setAlbumTitle(it.album)
            it.artworkUrl?.let { artUrl ->
                mediaMetadataBuilder.setArtworkUri(Uri.parse(artUrl))
            }
        }

        val songId = parsedSource.songId
        val songDuration = parsedMetadata?.duration ?: 0.0
        if (songId != null) {
            handleScrobbleSongStarted(songId, songDuration)
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
                requestAudioFocus()
                player.play()
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        if (requireServiceOrQueue(call)) return
        checkAndRequestNotificationPermission(call) {
            executePlay(call)
        }
    }

    private fun executePlay(call: PluginCall) {
        NativeLogger.debug("Play requested", "audio-plugin")
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

            requestAudioFocus()
            player.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        if (requireServiceOrQueue(call)) return
        executePause(call)
    }

    private fun executePause(call: PluginCall) {
        NativeLogger.debug("Pause requested", "audio-plugin")
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
        if (requireServiceOrQueue(call)) return
        executeStop(call)
    }

    private fun executeStop(call: PluginCall) {
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
        if (call.getDouble("position") == null) {
            call.reject("Missing position parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeSeek(call)
    }

    private fun executeSeek(call: PluginCall) {
        val position = call.getDouble("position") ?: 0.0
        NativeLogger.debug("Seek to $position", "audio-plugin")
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
        if (requireServiceOrQueue(call)) return
        executeUpdateMetadata(call)
    }

    private fun executeUpdateMetadata(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeClear(call)
    }

    private fun executeClear(call: PluginCall) {
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
            handleScrobbleSongEnded()
            abandonAudioFocus()
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
                }
            }

            val files = dir.listFiles()
            if (files != null) {
                for (file in files) {
                    if (file.name.startsWith("$cacheId.") && !file.name.endsWith(".json")) {
                        return JSObject().apply {
                            put("songId", songId)
                            put("uri", Uri.fromFile(file).toString())
                            put("contentType", "audio/mpeg")
                            put("sizeBytes", file.length())
                            put("lastModifiedAt", file.lastModified().toDouble())
                        }
                    }
                }
            }
        }
        return null
    }

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

    @PluginMethod
    fun setVolumeHUDEnabled(call: PluginCall) {
        call.resolve()
    }

    @PluginMethod
    fun getScrobbleBuffer(call: PluginCall) {
        val entries = scrobbleBuffer.getEntries()
        val array = JSONArray()
        for (entry in entries) {
            array.put(JSONObject().apply {
                put("songId", entry.songId)
                put("playedDurationMs", entry.playedDurationMs)
                put("timestamp", entry.timestamp)
            })
        }
        call.resolve(JSObject().apply {
            put("entries", array)
        })
    }

    @PluginMethod
    fun clearScrobbleBuffer(call: PluginCall) {
        scrobbleBuffer.clear()
        call.resolve()
    }

    // MARK: - Queue Engine Methods

    @PluginMethod
    fun setContextQueue(call: PluginCall) {
        if (call.getArray("songs") == null) {
            call.reject("Missing songs parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeSetContextQueue(call)
    }

    private fun executeSetContextQueue(call: PluginCall) {
        val service = playbackService ?: run {
            call.reject("Playback service is not ready")
            return
        }

        NativeLogger.debug("Setting context queue", "audio-plugin")
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
        if (call.getArray("songs") == null) {
            call.reject("Missing songs parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeUpdateContextQueue(call)
    }

    private fun executeUpdateContextQueue(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeReorderContextQueue(call)
    }

    private fun executeReorderContextQueue(call: PluginCall) {
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
        if (call.getArray("songs") == null) {
            call.reject("Missing songs parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeAddToUserQueue(call)
    }

    private fun executeAddToUserQueue(call: PluginCall) {
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
        if (call.getArray("indices") == null) {
            call.reject("Missing indices parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeRemoveFromUserQueue(call)
    }

    private fun executeRemoveFromUserQueue(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeClearUserQueue(call)
    }

    private fun executeClearUserQueue(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executePlayAtIndex(call)
    }

    private fun executePlayAtIndex(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeGetFullState(call)
    }

    private fun executeGetFullState(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeSetRepeatMode(call)
    }

    private fun executeSetRepeatMode(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeSetShuffle(call)
    }

    private fun executeSetShuffle(call: PluginCall) {
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
        if (call.getArray("originalSongs") == null) {
            call.reject("Missing originalSongs parameter")
            return
        }
        if (requireServiceOrQueue(call)) return
        executeMarkAsShuffled(call)
    }

    private fun executeMarkAsShuffled(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeSkipToNext(call)
    }

    private fun executeSkipToNext(call: PluginCall) {
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
        if (requireServiceOrQueue(call)) return
        executeSkipToPrevious(call)
    }

    private fun executeSkipToPrevious(call: PluginCall) {
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

    // Stubs for non-A5 capabilities

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
    fun resolveSongs(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "resolveSongs")
    }

    @PluginMethod
    fun setLikeActive(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setLikeActive")
    }
}
