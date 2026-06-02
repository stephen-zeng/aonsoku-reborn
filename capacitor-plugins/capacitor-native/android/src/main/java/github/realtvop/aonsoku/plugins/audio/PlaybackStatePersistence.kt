package github.realtvop.aonsoku.plugins.audio

import github.realtvop.aonsoku.plugins.preferences.NativePreferencesStore
import kotlinx.coroutines.*
import org.json.JSONObject

class PlaybackStatePersistence(
    private val preferencesStore: NativePreferencesStore,
    private val scope: CoroutineScope
) {
    private var stateProvider: (() -> PlaybackPersistState?)? = null
    private var debounceJob: Job? = null
    private var progressJob: Job? = null
    private var lastSavedProgress: Double = 0.0
    private var pendingProgress: Double = 0.0
    private var fullStateDirty = false

    private val fullStateDebounceIntervalMs = 500L
    private val progressSaveIntervalMs = 5000L

    fun setStateProvider(provider: () -> PlaybackPersistState?) {
        this.stateProvider = provider
    }

    fun markStateDirty() {
        fullStateDirty = true
        scheduleFullStateSave()
    }

    fun updateProgress(time: Double) {
        pendingProgress = time
    }

    fun flushNow() {
        debounceJob?.cancel()
        val state = stateProvider?.invoke() ?: return
        fullStateDirty = false
        lastSavedProgress = state.currentTime
        scope.launch(Dispatchers.IO) {
            try {
                preferencesStore.setQueueState(state.toJson().toString())
            } catch (_: Exception) {
            }
        }
    }

    fun startProgressTracking() {
        stopProgressTracking()
        progressJob = scope.launch(Dispatchers.Main) {
            while (isActive) {
                delay(progressSaveIntervalMs)
                val state = stateProvider?.invoke()
                if (state != null) {
                    updateProgress(state.currentTime)
                    withContext(Dispatchers.IO) {
                        saveProgressIfNeeded()
                    }
                }
            }
        }
    }

    fun stopProgressTracking() {
        progressJob?.cancel()
        progressJob = null
    }

    private fun scheduleFullStateSave() {
        debounceJob?.cancel()
        debounceJob = scope.launch(Dispatchers.Main) {
            delay(fullStateDebounceIntervalMs)
            val state = stateProvider?.invoke()
            if (state != null) {
                withContext(Dispatchers.IO) {
                    performFullSave(state)
                }
            }
        }
    }

    private suspend fun performFullSave(state: PlaybackPersistState) {
        fullStateDirty = false
        lastSavedProgress = state.currentTime
        try {
            preferencesStore.setQueueState(state.toJson().toString())
        } catch (_: Exception) {
        }
    }

    private suspend fun saveProgressIfNeeded() {
        val progress = pendingProgress
        if (kotlin.math.abs(progress - lastSavedProgress) <= 0.5) return
        lastSavedProgress = progress

        if (fullStateDirty) {
            // If dirty, scheduleFullStateSave will handle it shortly, or we can force it here if we have state
            val state = withContext(Dispatchers.Main) { stateProvider?.invoke() }
            if (state != null) {
                performFullSave(state)
                return
            }
        }

        val stateJsonStr = preferencesStore.getQueueState() ?: return
        try {
            val json = JSONObject(stateJsonStr)
            json.put("currentTime", progress)
            preferencesStore.setQueueState(json.toString())
        } catch (_: Exception) {
        }
    }
}
