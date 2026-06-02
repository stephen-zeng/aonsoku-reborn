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
import github.realtvop.aonsoku.plugins.preferences.NativePreferencesStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class PlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null
    private var player: ExoPlayer? = null

    val queueEngine = NativeQueueEngine()
    var isQueueEngineActive = false
    var savedRestoreTime: Double? = null

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val preferencesStore by lazy { NativePreferencesStore(this) }
    lateinit var persistence: PlaybackStatePersistence

    interface Listener {
        fun onRemoteCommand(command: String, position: Double?)
        fun onQueueStateChanged(currentIndex: Int, songId: String, reason: String, isInUserQueue: Boolean)
        fun onQueueContentsChanged(reason: String)
        fun onPlaybackStateChanged(state: String)
        fun onEnded(reason: String)
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

    inner class LocalBinder : Binder() {
        fun getService(): PlaybackService = this@PlaybackService
    }

    private val binder = LocalBinder()

    fun getPlayer(): ExoPlayer? = player
    fun getSession(): MediaSession? = mediaSession

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        val newPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true) // Handles audio focus changes automatically
            .setHandleAudioBecomingNoisy(true) // Pauses automatically when headphones are unplugged
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
        val url = resolveSongUri(song)
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
            val currentPlayer = player ?: return@post
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

    private fun resolveSongUri(song: QueueSong): String {
        return if (!song.cachedFileUri.isNullOrEmpty()) {
            song.cachedFileUri
        } else {
            song.streamUrl
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
