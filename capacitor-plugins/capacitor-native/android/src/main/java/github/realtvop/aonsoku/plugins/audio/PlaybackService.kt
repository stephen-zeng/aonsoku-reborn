package github.realtvop.aonsoku.plugins.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionResult
import github.realtvop.aonsoku.plugins.debug.NativeLogger
import github.realtvop.aonsoku.plugins.preferences.NativePreferencesStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class PlaybackService : MediaSessionService() {
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "aonsoku_playback"

        const val ACTION_PLAY_PAUSE = "github.realtvop.aonsoku.action.PLAY_PAUSE"
        const val ACTION_SKIP_NEXT = "github.realtvop.aonsoku.action.SKIP_NEXT"
        const val ACTION_SKIP_PREV = "github.realtvop.aonsoku.action.SKIP_PREV"
        const val ACTION_STOP = "github.realtvop.aonsoku.action.STOP"

        private const val REQUEST_CODE_CONTENT = 1000
        private const val REQUEST_CODE_PLAY_PAUSE = 1001
        private const val REQUEST_CODE_SKIP_NEXT = 1002
        private const val REQUEST_CODE_SKIP_PREV = 1003
        private const val REQUEST_CODE_STOP = 1004
    }

    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null
    private var cachedArtworkBitmap: Bitmap? = null
    private var skipCommandsEnabled = false

    val queueEngine = NativeQueueEngine()
    var isQueueEngineActive = false
    var savedRestoreTime: Double? = null

    var sleepTimerMode: String = "duration"

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val preferencesStore by lazy { NativePreferencesStore(this) }
    lateinit var persistence: PlaybackStatePersistence

    val downloadManager by lazy { NativeDownloadManager(this) }
    private val backgroundCacheSongIds = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private val downloadListeners = mutableListOf<DownloadListener>()

    interface DownloadListener {
        fun onDownloadProgress(songId: String, loaded: Long, total: Long)
        fun onDownloadCompleted(songId: String, fileUri: String, contentType: String, sizeBytes: Long)
        fun onDownloadFailed(songId: String, errorMessage: String)
    }

    fun addDownloadListener(listener: DownloadListener) {
        synchronized(downloadListeners) {
            if (!downloadListeners.contains(listener)) {
                downloadListeners.add(listener)
            }
        }
    }

    fun removeDownloadListener(listener: DownloadListener) {
        synchronized(downloadListeners) {
            downloadListeners.remove(listener)
        }
    }

    fun isBackgroundCache(songId: String): Boolean = backgroundCacheSongIds.contains(songId)
    fun removeBackgroundCache(songId: String): Boolean = backgroundCacheSongIds.remove(songId)

    private fun startBackgroundCache(songId: String) {
        val cacheId = AudioCacheUtils.cacheId(songId)
        val extensions = listOf("mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "audio")

        val cacheDirectories = listOf(
            AudioCacheUtils.getCacheDirectory(this),
            AudioCacheUtils.getSecondaryCacheDirectory(this)
        )
        for (directory in cacheDirectories) {
            if (directory.exists() && directory.isDirectory) {
                for (ext in extensions) {
                    if (File(directory, "$cacheId.$ext").exists()) {
                        return
                    }
                }
            }
        }

        backgroundCacheSongIds.add(songId)
        downloadManager.download(songId)
    }

    interface Listener {
        fun onRemoteCommand(command: String, position: Double?)
        fun onQueueStateChanged(currentIndex: Int, songId: String, reason: String, isInUserQueue: Boolean)
        fun onQueueContentsChanged(reason: String)
        fun onPlaybackStateChanged(state: String)
        fun onEnded(reason: String)
        fun onSleepTimerEndOfTrack()
        fun onError(code: String, message: String)
    }

    private val listeners = mutableListOf<Listener>()

    fun addListener(listener: Listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: Listener) {
        listeners.remove(listener)
    }

    private fun emitRemoteCommand(command: String, position: Double? = null) {
        listeners.forEach { it.onRemoteCommand(command, position) }
    }

    private fun emitQueueStateChanged(currentIndex: Int, songId: String, reason: String, isInUserQueue: Boolean) {
        listeners.forEach { it.onQueueStateChanged(currentIndex, songId, reason, isInUserQueue) }
    }

    private fun emitQueueContentsChanged(reason: String) {
        listeners.forEach { it.onQueueContentsChanged(reason) }
    }

    private fun emitPlaybackState(state: String) {
        listeners.forEach { it.onPlaybackStateChanged(state) }
    }

    private fun emitEnded(reason: String) {
        listeners.forEach { it.onEnded(reason) }
    }

    private fun emitSleepTimerEndOfTrack() {
        listeners.forEach { it.onSleepTimerEndOfTrack() }
    }

    private fun emitError(code: String, message: String) {
        listeners.forEach { it.onError(code, message) }
    }

    inner class LocalBinder : Binder() {
        fun getService(): PlaybackService = this@PlaybackService
    }

    private val binder = LocalBinder()

    fun getPlayer(): ExoPlayer? = player
    fun getSession(): MediaSession? = mediaSession

    override fun onCreate() {
        super.onCreate()
        NativeLogger.info("PlaybackService created", "playback-service")

        createNotificationChannel()

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        val newPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build()

        player = newPlayer

        // Force skip commands so notification action buttons are always visible.
        // ExoPlayer only advertises COMMAND_SEEK_TO_NEXT / _PREVIOUS when the
        // timeline has more than one item; without them, the system may hide
        // the action buttons added to the MediaStyle notification.
        applySkipCommands()

        persistence = PlaybackStatePersistence(preferencesStore, serviceScope).apply {
            setStateProvider {
                val currentPlayer = player ?: return@setStateProvider null
                val progressSec = currentPlayer.currentPosition / 1000.0
                PlaybackPersistState.from(queueEngine, progressSec)
            }
        }

        queueEngine.delegate = object : NativeQueueEngineDelegate {
            override fun queueEngineLoadSong(engine: NativeQueueEngine, song: QueueSong, autoplay: Boolean, startTime: Double?) {
                loadSong(song, autoplay, startTime)
            }

            override fun queueEngineDidAdvanceTo(engine: NativeQueueEngine, index: Int, songId: String, reason: QueueAdvanceReason) {
                persistence.markStateDirty()
                emitQueueStateChanged(index, songId, reason.value, engine.isInUserQueue)
            }

            override fun queueEngineDidChangeContents(engine: NativeQueueEngine, reason: String) {
                persistence.markStateDirty()
                emitQueueContentsChanged(reason)
            }

            override fun queueEngineDidExhaustQueue(engine: NativeQueueEngine) {
                val mainHandler = Handler(Looper.getMainLooper())
                mainHandler.post {
                    player?.pause()
                    player?.seekTo(0)
                    emitPlaybackState("ended")
                    emitEnded("finished")
                }
            }

            override fun queueEngineSeekToStart(engine: NativeQueueEngine, song: QueueSong) {
                val mainHandler = Handler(Looper.getMainLooper())
                mainHandler.post {
                    player?.seekTo(0)
                    player?.play()
                }
            }
        }

        newPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    if (sleepTimerMode == "endOfTrack") {
                        sleepTimerMode = "duration"
                        player?.pause()
                        emitPlaybackState("paused")
                        emitSleepTimerEndOfTrack()
                        return
                    }
                    if (isQueueEngineActive) {
                        queueEngine.handleEnded()
                    } else {
                        emitEnded("finished")
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateNotification()
                if (isPlaying) {
                    persistence.startProgressTracking()
                } else {
                    persistence.stopProgressTracking()
                    persistence.flushNow()
                }
            }
        })

        val callback = object : MediaSession.Callback {
            override fun onPlayerCommandRequest(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                playerCommand: Int
            ): Int {
                when (playerCommand) {
                    Player.COMMAND_SEEK_TO_NEXT -> {
                        if (isQueueEngineActive) {
                            queueEngine.skipToNext()
                            return SessionResult.RESULT_INFO_SKIPPED
                        }
                        emitRemoteCommand("next")
                        return SessionResult.RESULT_INFO_SKIPPED
                    }
                    Player.COMMAND_SEEK_TO_PREVIOUS -> {
                        if (isQueueEngineActive) {
                            val currentTime = (player?.currentPosition ?: 0L) / 1000.0
                            queueEngine.skipToPrevious(currentTime)
                            return SessionResult.RESULT_INFO_SKIPPED
                        }
                        emitRemoteCommand("previous")
                        return SessionResult.RESULT_INFO_SKIPPED
                    }
                    else -> {
                        if (!isQueueEngineActive) {
                            val commandName = when (playerCommand) {
                                Player.COMMAND_PLAY_PAUSE -> "togglePlayPause"
                                Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM -> "seek"
                                else -> null
                            }
                            if (commandName != null) {
                                emitRemoteCommand(commandName)
                                return SessionResult.RESULT_INFO_SKIPPED
                            }
                        }
                        return super.onPlayerCommandRequest(session, controller, playerCommand)
                    }
                }
            }
        }

        mediaSession = MediaSession.Builder(this, newPlayer)
            .setCallback(callback)
            .build()

        showNotification()

        downloadManager.addListener(object : NativeDownloadManager.Listener {
            override fun onDownloadProgress(songId: String, loaded: Long, total: Long) {
                synchronized(downloadListeners) {
                    downloadListeners.forEach { it.onDownloadProgress(songId, loaded, total) }
                }
            }

            override fun onDownloadCompleted(songId: String, fileUri: String, contentType: String, sizeBytes: Long) {
                synchronized(downloadListeners) {
                    downloadListeners.forEach { it.onDownloadCompleted(songId, fileUri, contentType, sizeBytes) }
                }
            }

            override fun onDownloadFailed(songId: String, errorMessage: String) {
                synchronized(downloadListeners) {
                    downloadListeners.forEach { it.onDownloadFailed(songId, errorMessage) }
                }
            }
        })

        restorePlaybackState()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Music playback controls"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
            NativeLogger.info("Notification channel created: $CHANNEL_ID", "playback-service")
        }
    }

    private fun buildNotification(isPlaying: Boolean = false): Notification {
        val session = mediaSession
        val title: String
        val text: String
        var subText: String? = null
        if (session != null) {
            val metadata = session.player.mediaMetadata
            title = metadata.title?.toString() ?: "Aonsoku"
            text = metadata.artist?.toString() ?: "Playing"
            subText = metadata.albumTitle?.toString()
        } else {
            title = "Aonsoku"
            text = "Playing"
        }

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        } ?: Intent()
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            REQUEST_CODE_CONTENT,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val stopIntent = Intent(this, PlaybackService::class.java).setAction(ACTION_STOP)
        val stopPendingIntent = PendingIntent.getService(
            this,
            REQUEST_CODE_STOP,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val style = MediaStyle()
            .setShowActionsInCompactView(0, 1, 2)
        if (session != null) {
            style.setMediaSession(session.sessionCompatToken)
        }

        val prevIntent = Intent(this, PlaybackService::class.java).setAction(ACTION_SKIP_PREV)
        val prevPendingIntent = PendingIntent.getService(
            this,
            REQUEST_CODE_SKIP_PREV,
            prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val playPauseIntent = Intent(this, PlaybackService::class.java).setAction(ACTION_PLAY_PAUSE)
        val playPausePendingIntent = PendingIntent.getService(
            this,
            REQUEST_CODE_PLAY_PAUSE,
            playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val nextIntent = Intent(this, PlaybackService::class.java).setAction(ACTION_SKIP_NEXT)
        val nextPendingIntent = PendingIntent.getService(
            this,
            REQUEST_CODE_SKIP_NEXT,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

        val iconResId = resources.getIdentifier("ic_notification", "drawable", packageName)
        val icon = if (iconResId != 0) iconResId else android.R.drawable.ic_menu_info_details

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setLargeIcon(cachedArtworkBitmap)
            .setContentTitle(title)
            .setContentText(text)
            .setSubText(subText)
            .setContentIntent(contentPendingIntent)
            .setDeleteIntent(stopPendingIntent)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setStyle(style)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
            .addAction(playPauseIcon, playPauseLabel, playPausePendingIntent)
            .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)

        return builder.build()
    }

    private fun showNotification() {
        val isPlaying = player?.isPlaying ?: false
        val notification = buildNotification(isPlaying)
        startForeground(NOTIFICATION_ID, notification)
    }

    fun clearArtworkCache() {
        cachedArtworkBitmap = null
    }

    fun updateNotification() {
        if (player != null) {
            showNotification()
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onBind(intent: Intent?): IBinder? {
        if (intent?.action == SERVICE_INTERFACE) {
            return super.onBind(intent)
        }
        return binder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_PAUSE -> {
                val currentPlayer = player ?: return START_STICKY
                if (currentPlayer.isPlaying) {
                    currentPlayer.pause()
                } else {
                    currentPlayer.play()
                }
                updateNotification()
            }
            ACTION_SKIP_NEXT -> {
                if (isQueueEngineActive) {
                    queueEngine.skipToNext()
                } else {
                    emitRemoteCommand("next")
                }
                updateNotification()
            }
            ACTION_SKIP_PREV -> {
                if (isQueueEngineActive) {
                    val currentTime = (player?.currentPosition ?: 0L) / 1000.0
                    queueEngine.skipToPrevious(currentTime)
                } else {
                    emitRemoteCommand("previous")
                }
                updateNotification()
            }
            ACTION_STOP -> {
                player?.stop()
                player?.clearMediaItems()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    override fun onDestroy() {
        NativeLogger.info("PlaybackService destroyed", "playback-service")
        serviceScope.cancel()
        persistence.stopProgressTracking()
        listeners.clear()
        mediaSession?.run {
            player?.release()
            release()
            mediaSession = null
        }
        player = null
        super.onDestroy()
    }

    fun loadSong(song: QueueSong, autoplay: Boolean, startTime: Double?) {
        NativeLogger.debug("Loading song: ${song.title} - ${song.artist} (autoplay=$autoplay)", "playback-service")
        val resolver = NativeSourceResolver(this)
        val resolved = resolver.resolveSource(song)

        if (resolved == null) {
            val isCredentialsMissing = song.streamUrl.startsWith("aonsoku-media://")
            val code = if (isCredentialsMissing) "missing_credentials" else "invalid_source"
            val message = if (isCredentialsMissing) {
                "Cannot resolve aonsoku-media://stream: no credentials for song ${song.id}"
            } else {
                "Cannot resolve source for song ${song.id}: ${song.streamUrl}"
            }
            NativeLogger.error(message, "playback-service")
            emitError(code, message)
            val mainHandler = Handler(Looper.getMainLooper())
            mainHandler.post {
                val currentPlayer = player ?: return@post
                currentPlayer.stop()
                currentPlayer.clearMediaItems()
                emitPlaybackState("failed")
            }
            return
        }

        val url = resolved.first
        val kind = resolved.second

        if (kind == "stream") {
            startBackgroundCache(song.id)
        }

        val artworkUrl = resolveArtworkUrl(song)

        val mediaMetadataBuilder = MediaMetadata.Builder()
            .setTitle(song.title)
            .setArtist(song.artist)
            .setAlbumTitle(song.album)
        artworkUrl?.let {
            mediaMetadataBuilder.setArtworkUri(Uri.parse(it))
        }

        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(url))
            .setMediaMetadata(mediaMetadataBuilder.build())
            .build()

        cachedArtworkBitmap = null

        val mainHandler = Handler(Looper.getMainLooper())
        mainHandler.post {
            val currentPlayer = player ?: run {
                NativeLogger.error("loadSong: player is null, aborting", "playback-service")
                return@post
            }
            currentPlayer.stop()
            currentPlayer.clearMediaItems()
            currentPlayer.setMediaItem(mediaItem)
            currentPlayer.prepare()
            if (startTime != null && startTime > 0.0) {
                currentPlayer.seekTo((startTime * 1000).toLong())
            }
            if (autoplay) {
                currentPlayer.play()
            }
            showNotification()
            loadAndCacheArtwork(artworkUrl)
        }
    }

    private fun resolveArtworkUrl(song: QueueSong): String? {
        val coverArtId = song.coverArtId
        if (coverArtId.isNullOrEmpty()) return null
        val resolver = NativeSourceResolver(this)
        return resolver.resolveCoverArtUrl(coverArtId, 300)
    }

    private fun applySkipCommands() {
        val currentPlayer = player ?: return
        val commands = currentPlayer.getAvailableCommands()
            .buildUpon()
            .add(Player.COMMAND_SEEK_TO_NEXT)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .build()
        currentPlayer.setAvailableCommands(commands)
        skipCommandsEnabled = true
    }

    fun loadAndCacheArtwork(artworkUrl: String?) {
        val url = artworkUrl ?: return
        cachedArtworkBitmap = null
        serviceScope.launch(Dispatchers.IO) {
            try {
                val inputStream = java.net.URL(url).openStream()
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream.close()
                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        cachedArtworkBitmap = bitmap
                        updateNotification()
                    }
                }
            } catch (e: Exception) {
                NativeLogger.warn("Failed to load artwork: ${e.message}", "playback-service")
            }
        }
    }

    private fun restorePlaybackState() {
        serviceScope.launch(Dispatchers.IO) {
            try {
                val stateJsonStr = preferencesStore.getQueueState()
                if (!stateJsonStr.isNullOrEmpty()) {
                    val json = JSONObject(stateJsonStr)
                    val persistedState = PlaybackPersistState.fromJson(json)
                    withContext(Dispatchers.Main) {
                        queueEngine.restoreState(persistedState)
                        isQueueEngineActive = true

                        val song = queueEngine.currentSong
                        if (song != null) {
                            savedRestoreTime = persistedState.currentTime
                            loadSong(song, autoplay = false, startTime = persistedState.currentTime)
                        }
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    fun setContextQueue(songs: List<QueueSong>, currentIndex: Int, autoplay: Boolean, startTime: Double?, sourceId: QueueSourceId?, sourceName: String?) {
        isQueueEngineActive = true
        queueEngine.setContextQueue(songs, currentIndex, autoplay, startTime, sourceId, sourceName)
        persistence.markStateDirty()
    }

    fun updateContextQueue(songs: List<QueueSong>, currentIndex: Int) {
        queueEngine.updateContextQueue(songs, currentIndex)
        persistence.markStateDirty()
    }

    fun reorderContextQueue(fromIndex: Int, toIndex: Int) {
        queueEngine.reorderContextQueue(fromIndex, toIndex)
        persistence.markStateDirty()
    }

    fun addToUserQueue(songs: List<QueueSong>, position: String) {
        queueEngine.addToUserQueue(songs, position)
        persistence.markStateDirty()
    }

    fun removeFromUserQueue(indices: List<Int>) {
        queueEngine.removeFromUserQueue(indices)
        persistence.markStateDirty()
    }

    fun clearUserQueue() {
        queueEngine.clearUserQueue()
        persistence.markStateDirty()
    }

    fun playAtIndex(index: Int, startTime: Double?) {
        queueEngine.playAtIndex(index, startTime)
        persistence.markStateDirty()
    }

    fun setRepeatMode(mode: String) {
        val loopState = LoopState.fromValue(mode)
        queueEngine.setLoopState(loopState)
        persistence.markStateDirty()
    }

    fun setShuffle(enabled: Boolean) {
        queueEngine.setShuffleActive(enabled)
        persistence.markStateDirty()
    }

    fun markAsShuffled(originalSongs: List<QueueSong>) {
        queueEngine.markAsShuffled(originalSongs)
        persistence.markStateDirty()
    }

    fun clearQueueState() {
        isQueueEngineActive = false
        queueEngine.setContextQueue(emptyList(), 0, false, null, null, null)
        persistence.stopProgressTracking()
        serviceScope.launch(Dispatchers.IO) {
            preferencesStore.setQueueState("")
        }
    }
}
