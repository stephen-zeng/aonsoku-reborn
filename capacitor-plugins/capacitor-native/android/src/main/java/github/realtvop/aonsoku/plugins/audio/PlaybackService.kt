package github.realtvop.aonsoku.plugins.audio

import android.content.Intent
import android.net.Uri
import android.os.Binder
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.OptIn
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
    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null

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

    inner class LocalBinder : Binder() {
        fun getService(): PlaybackService = this@PlaybackService
    }

    private val binder = LocalBinder()

    fun getPlayer(): ExoPlayer? = player
    fun getSession(): MediaSession? = mediaSession

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        NativeLogger.info("PlaybackService created", "playback-service")
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        val newPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build()

        player = newPlayer

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
                    if (sleepTimerMode == "end-of-track") {
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
                if (playerCommand == Player.COMMAND_SEEK_TO_NEXT) {
                    emitRemoteCommand("next")
                    return SessionResult.RESULT_INFO_SKIPPED
                }
                if (playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS) {
                    emitRemoteCommand("previous")
                    return SessionResult.RESULT_INFO_SKIPPED
                }
                return super.onPlayerCommandRequest(session, controller, playerCommand)
            }
        }

        mediaSession = MediaSession.Builder(this, newPlayer)
            .setCallback(callback)
            .build()

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

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onBind(intent: Intent?): IBinder? {
        if (intent?.action == SERVICE_INTERFACE) {
            return super.onBind(intent)
        }
        return binder
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

        if (resolved == null && (song.streamUrl.startsWith("aonsoku-media://") || song.streamUrl.isNullOrEmpty())) {
            NativeLogger.error("Cannot resolve source for song ${song.id}: missing credentials or unresolvable stream URL", "playback-service")
            emitPlaybackState("failed")
            return
        }

        val url = resolved?.first ?: song.streamUrl
        val kind = resolved?.second ?: "stream"

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
        }
    }

    private fun resolveArtworkUrl(song: QueueSong): String? {
        val coverArtId = song.coverArtId
        if (coverArtId.isNullOrEmpty()) return null
        return "aonsoku-media://getCoverArt?id=$coverArtId&size=300"
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
