package github.realtvop.aonsoku.plugins.data

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import github.realtvop.aonsoku.plugins.error.AonsokuNativeError

@CapacitorPlugin(name = "AonsokuNativeData")
class DataPlugin : Plugin() {
    private val pluginName = "DataPlugin"

    @PluginMethod
    fun initialize(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "initialize")
    }

    @PluginMethod
    fun importBulk(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "importBulk")
    }

    @PluginMethod
    fun syncAll(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "syncAll")
    }

    @PluginMethod
    fun syncIncremental(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "syncIncremental")
    }

    @PluginMethod
    fun cancelSync(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "cancelSync")
    }

    @PluginMethod
    fun getSyncState(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getSyncState")
    }

    @PluginMethod
    fun getArtists(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getArtists")
    }

    @PluginMethod
    fun getArtist(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getArtist")
    }

    @PluginMethod
    fun getAlbums(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getAlbums")
    }

    @PluginMethod
    fun getAlbum(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getAlbum")
    }

    @PluginMethod
    fun getSongs(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getSongs")
    }

    @PluginMethod
    fun getPlaylists(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getPlaylists")
    }

    @PluginMethod
    fun getPlaylist(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getPlaylist")
    }

    @PluginMethod
    fun getGenres(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getGenres")
    }

    @PluginMethod
    fun getFavorites(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getFavorites")
    }

    @PluginMethod
    fun search(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "search")
    }

    @PluginMethod
    fun getLyrics(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getLyrics")
    }

    @PluginMethod
    fun storeLyrics(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "storeLyrics")
    }

    @PluginMethod
    fun getCacheStats(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getCacheStats")
    }

    @PluginMethod
    fun isDataAvailableOffline(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "isDataAvailableOffline")
    }

    @PluginMethod
    fun storeCoverImage(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "storeCoverImage")
    }

    @PluginMethod
    fun resolveCoverImage(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "resolveCoverImage")
    }

    @PluginMethod
    fun getCoverImageSize(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getCoverImageSize")
    }

    @PluginMethod
    fun deleteCoverImage(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "deleteCoverImage")
    }

    @PluginMethod
    fun clearCoverImages(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearCoverImages")
    }

    @PluginMethod
    fun downloadCoverImage(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "downloadCoverImage")
    }
}
