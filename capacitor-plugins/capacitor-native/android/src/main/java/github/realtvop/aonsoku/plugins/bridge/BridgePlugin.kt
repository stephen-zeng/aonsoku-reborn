package github.realtvop.aonsoku.plugins.bridge

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import github.realtvop.aonsoku.plugins.error.AonsokuNativeError

@CapacitorPlugin(name = "AonsokuNativeBridge")
class BridgePlugin : Plugin() {
    private val pluginName = "BridgePlugin"

    @PluginMethod
    fun storeCredentials(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "storeCredentials")
    }

    @PluginMethod
    fun getCredentials(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "getCredentials")
    }

    @PluginMethod
    fun clearCredentials(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "clearCredentials")
    }

    @PluginMethod
    fun hasCredentials(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "hasCredentials")
    }

    @PluginMethod
    fun login(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "login")
    }

    @PluginMethod
    fun ping(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "ping")
    }

    @PluginMethod
    fun queryServerInfo(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "queryServerInfo")
    }

    @PluginMethod
    fun request(call: PluginCall) {
        AonsokuNativeError.rejectUnimplemented(call, pluginName, "request")
    }
}
