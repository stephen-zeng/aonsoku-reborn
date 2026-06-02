package github.realtvop.aonsoku.plugins.data
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

class EventEmitter(private val notifyListeners: (String, JSObject) -> Unit) {
    private val h: Handler? = try { Handler(Looper.getMainLooper()) } catch (_: Exception) { null }
    private var pending: JSObject? = null
    private var scheduled: Runnable? = null
    private val terminalPhases = setOf("done", "error", "cancelled")

    fun emitSyncStateChanged(state: Map<String, Any?>) {
        val js = JSObject(); for ((k, v) in state) when (v) { is String -> js.put(k, v); is Number -> js.put(k, v.toDouble()); is Boolean -> js.put(k, v); else -> js.put(k, JSONObject.NULL) }
        pending = js
        val phase = state["phase"] as? String
        if (phase in terminalPhases) {
            forceFlush()
        } else if (scheduled == null) {
            val r = Runnable { flush(); scheduled = null }; scheduled = r
            h?.postDelayed(r, 200)
        }
    }
    fun emitDataChanged(tables: List<String>, tier: String) { flushDataChanged(tables, tier) }
    private fun flushDataChanged(tables: List<String>, tier: String) { notifyListeners("dataChanged", JSObject().apply { put("tables", JSONArray(tables)); put("tier", tier) }) }
    fun forceFlush() { scheduled?.let { h?.removeCallbacks(it) }; scheduled = null; flush() }
    private fun flush() { val s = pending ?: return; pending = null; notifyListeners("syncStateChanged", s) }
}
