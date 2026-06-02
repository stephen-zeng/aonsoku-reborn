package github.realtvop.aonsoku.plugins.data
import android.os.Handler
import android.os.Looper
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

class EventEmitter(private val bridge: Bridge) {
    private val h = Handler(Looper.getMainLooper())
    private var pending: JSObject? = null
    private var scheduled: Runnable? = null

    fun emitSyncStateChanged(state: Map<String, Any?>) {
        val js = JSObject(); for ((k, v) in state) when (v) { is String -> js.put(k, v); is Number -> js.put(k, v.toDouble()); is Boolean -> js.put(k, v); else -> js.put(k, JSONObject.NULL) }
        pending = js
        if (scheduled == null) { val r = Runnable { flush(); scheduled = null }; scheduled = r; h.postDelayed(r, 200) }
    }
    fun emitDataChanged(tables: List<String>, tier: String) { h.post { bridge.triggerJSEvent("dataChanged", JSObject().apply { put("tables", JSONArray(tables)); put("tier", tier) }.toString()) } }
    fun forceFlush() { scheduled?.let { h.removeCallbacks(it) }; scheduled = null; flush() }
    private fun flush() { val s = pending ?: return; pending = null; bridge.triggerJSEvent("syncStateChanged", s.toString()) }
}