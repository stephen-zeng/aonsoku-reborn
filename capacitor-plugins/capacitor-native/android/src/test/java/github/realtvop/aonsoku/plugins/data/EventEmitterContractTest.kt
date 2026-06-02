package github.realtvop.aonsoku.plugins.data

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentCaptor
import org.mockito.ArgumentMatchers
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify

class EventEmitterContractTest {
    private lateinit var plugin: Plugin
    private lateinit var emitter: EventEmitter

    @Before
    fun setUp() {
        plugin = mock(Plugin::class.java)
        emitter = EventEmitter { event, data -> plugin.notifyListeners(event, data) }
    }

    @Test
    fun emitSyncStateChangedNotifiesListeners() {
        val state = mapOf<String, Any?>("phase" to "songs", "tier" to "t3", "isSyncing" to true, "progress" to 50)

        emitter.emitSyncStateChanged(state)

        val captor = ArgumentCaptor.forClass(JSObject::class.java)
        verify(plugin).notifyListeners(ArgumentMatchers.eq("syncStateChanged"), captor.capture())
        val captured = captor.value
        assertTrue(captured.has("phase"))
        assertTrue(captured.has("tier"))
        assertTrue(captured.has("isSyncing"))
    }

    @Test
    fun emitDataChangedNotifiesListeners() {
        val tables = listOf("artists", "albums")
        emitter.emitDataChanged(tables, "t2")

        val captor = ArgumentCaptor.forClass(JSObject::class.java)
        verify(plugin).notifyListeners(ArgumentMatchers.eq("dataChanged"), captor.capture())
        val captured = captor.value
        assertTrue(captured.has("tables"))
        assertTrue(captured.has("tier"))
    }

    @Test
    fun terminalPhaseIsFlushedImmediately() {
        val state = mapOf<String, Any?>("phase" to "done", "isSyncing" to false)

        emitter.emitSyncStateChanged(state)

        val captor = ArgumentCaptor.forClass(JSObject::class.java)
        verify(plugin).notifyListeners(ArgumentMatchers.eq("syncStateChanged"), captor.capture())
        val captured = captor.value
        assertTrue(captured.has("phase"))
    }

    @Test
    fun intermediateStateHasDelayButEventIsSent() {
        val state = mapOf<String, Any?>("phase" to "genres", "tier" to "t1", "isSyncing" to true)

        emitter.emitSyncStateChanged(state)

        // The postDelayed will execute on the main thread loop which doesn't exist in tests.
        // After forceFlush the event should be dispatched.
        emitter.forceFlush()

        val captor = ArgumentCaptor.forClass(JSObject::class.java)
        verify(plugin).notifyListeners(ArgumentMatchers.eq("syncStateChanged"), captor.capture())
        val captured = captor.value
        assertTrue(captured.has("phase"))
    }
}
