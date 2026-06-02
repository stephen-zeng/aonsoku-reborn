package github.realtvop.aonsoku.plugins.preferences

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import github.realtvop.aonsoku.plugins.error.AonsokuNativeError

@CapacitorPlugin(name = "AonsokuNativePreferences")
class PreferencesPlugin : Plugin() {
    private val pluginName = "PreferencesPlugin"

    @PluginMethod
    fun getAllPreferences(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getAllPreferences")
    }

    @PluginMethod
    fun setPreferences(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setPreferences")
    }

    @PluginMethod
    fun setPreference(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setPreference")
    }

    @PluginMethod
    fun deletePreference(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "deletePreference")
    }

    @PluginMethod
    fun getQueueState(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getQueueState")
    }

    @PluginMethod
    fun setQueueState(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "setQueueState")
    }

    @PluginMethod
    fun getPlayHistory(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getPlayHistory")
    }

    @PluginMethod
    fun addToPlayHistory(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "addToPlayHistory")
    }

    @PluginMethod
    fun clearPlayHistory(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearPlayHistory")
    }
}
