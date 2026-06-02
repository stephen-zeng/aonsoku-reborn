package github.realtvop.aonsoku.plugins.error

import com.getcapacitor.PluginCall

object AonsokuNativeError {
    const val CODE_UNIMPLEMENTED = "UNIMPLEMENTED"

    fun rejectUnimplemented(call: PluginCall, pluginName: String, method: String) {
        call.reject(
            "$pluginName.$method is not yet implemented on Android. See A1-A8 for incremental enablement.",
            CODE_UNIMPLEMENTED,
        )
    }
}
