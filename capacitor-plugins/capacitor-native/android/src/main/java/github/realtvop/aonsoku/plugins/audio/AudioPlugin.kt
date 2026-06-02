package github.realtvop.aonsoku.plugins.audio

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import github.realtvop.aonsoku.plugins.error.AonsokuNativeError

@CapacitorPlugin(name = "AonsokuNativeAudio")
class AudioPlugin : Plugin() {
    private val pluginName = "AudioPlugin"

    @PluginMethod
    fun load(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "load")
    }

    @PluginMethod
    fun play(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "play")
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "pause")
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "stop")
    }

    @PluginMethod
    fun seek(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "seek")
    }

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
    fun updateMetadata(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "updateMetadata")
    }

    @PluginMethod
    fun preload(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "preload")
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clear")
    }

    @PluginMethod
    fun storeAudioFile(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "storeAudioFile")
    }

    @PluginMethod
    fun resolveAudioFile(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "resolveAudioFile")
    }

    @PluginMethod
    fun getAudioFileSize(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getAudioFileSize")
    }

    @PluginMethod
    fun deleteAudioFile(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "deleteAudioFile")
    }

    @PluginMethod
    fun clearAudioFiles(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearAudioFiles")
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
    fun setVolumeHUDEnabled(call: PluginCall) {
        call.resolve()
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
