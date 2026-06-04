package github.realtvop.aonsoku.plugins.error

import com.getcapacitor.PluginCall

object AonsokuNativeError {
    const val CODE_UNIMPLEMENTED = "UNIMPLEMENTED"
    const val CODE_PLAYBACK_FAILED = "playback_failed"
    const val CODE_AUDIO_FOCUS_LOST = "audio_focus_lost"
    const val CODE_AUDIO_SESSION_FAILED = "audio_session_failed"
    const val CODE_NETWORK_UNREACHABLE = "network_unreachable"
    const val CODE_DECODE_ERROR = "decode_error"
    const val CODE_UNKNOWN = "unknown_error"

    fun rejectUnimplemented(call: PluginCall, pluginName: String, method: String) {
        call.reject(
            "$pluginName.$method is not yet implemented on Android. See A1-A8 for incremental enablement.",
            CODE_UNIMPLEMENTED,
        )
    }

    fun reject(call: PluginCall, code: String, message: String) {
        call.reject(message, code)
    }

    fun resolveError(call: PluginCall, code: String, message: String) {
        call.reject(message, code)
    }
}
