package github.realtvop.aonsoku.plugins.debug

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.content.ClipboardManager
import android.text.TextWatcher
import android.text.Editable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.C
import androidx.media3.common.Player
import github.realtvop.aonsoku.plugins.audio.PlaybackService
import github.realtvop.aonsoku.plugins.audio.QueueSong
import github.realtvop.aonsoku.plugins.bridge.AndroidCredentialStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DebugActivity : AppCompatActivity() {
    private var playbackService: PlaybackService? = null
    private var isBound = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var refreshTimer: Handler? = null
    private var currentTab = 0

    private lateinit var tabContainer: LinearLayout
    private lateinit var contentContainer: LinearLayout
    private lateinit var playbackContent: LinearLayout
    private lateinit var infoContent: LinearLayout
    private lateinit var logsScrollView: ScrollView
    private lateinit var logsContainer: LinearLayout
    private lateinit var searchEditText: EditText
    private lateinit var filterContainer: LinearLayout
    private lateinit var logsTabContent: LinearLayout

    private var searchText = ""
    private var activeLevels = mutableSetOf(NativeLogger.Entry.Level.DEBUG, NativeLogger.Entry.Level.INFO, NativeLogger.Entry.Level.WARN, NativeLogger.Entry.Level.ERROR)
    private var activeSources = mutableSetOf<String>()
    private var allSources = listOf<String>()
    private var isSelectingLogs = false
    private var selectedLogIndices = mutableSetOf<Int>()

    private val credentialStore by lazy { AndroidCredentialStore(this) }

    private val timeFormatter = SimpleDateFormat("HH:mm:ss", Locale.US)
    private val copyTimeFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? PlaybackService.LocalBinder
            playbackService = binder?.getService()
            isBound = true
            NativeLogger.debug("DebugActivity bound to PlaybackService", "debug-activity")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playbackService = null
            isBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(createMainLayout())
        bindPlaybackService()
        startAutoRefresh()
        NativeLogger.info("DebugActivity opened", "debug-activity")
    }

    override fun onDestroy() {
        stopAutoRefresh()
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
        super.onDestroy()
    }

    private fun createMainLayout(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setPadding(0, dp(8), 0, 0)
        }

        val titleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(16), 0, dp(16), dp(8))
        }
        TextView(this).apply {
            text = "Debug"
            textSize = 20f
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }.let { titleRow.addView(it) }
        Button(this).apply {
            text = "Close"
            setOnClickListener { finish() }
        }.let { titleRow.addView(it) }
        root.addView(titleRow)

        tabContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(16), 0, dp(16), dp(4))
        }
        val tabs = listOf("Playback", "Info", "Logs")
        tabs.forEachIndexed { index, title ->
            Button(this).apply {
                text = title
                layoutParams = LinearLayout.LayoutParams(0, dp(40), 1f)
                setOnClickListener { switchTab(index) }
                setBackgroundColor(if (index == 0) 0xFF3B82F6.toInt() else 0xFF374151.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                tag = index
            }.let { tabContainer.addView(it) }
        }
        root.addView(tabContainer)

        val scrollContainer = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }

        contentContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(16), dp(8), dp(16), dp(16))
        }
        scrollContainer.addView(contentContainer)
        root.addView(scrollContainer)

        setupPlaybackTab()
        setupInfoTab()
        setupLogsTab()
        showPlaybackContent()

        return root
    }

    private fun dp(value: Int): Int {
        val scale = resources.displayMetrics.density
        return (value * scale + 0.5f).toInt()
    }

    private fun switchTab(index: Int) {
        currentTab = index
        for (i in 0 until tabContainer.childCount) {
            val btn = tabContainer.getChildAt(i) as? Button ?: continue
            btn.setBackgroundColor(if (i == index) 0xFF3B82F6.toInt() else 0xFF374151.toInt())
        }
        isSelectingLogs = false
        selectedLogIndices.clear()
        when (index) {
            0 -> showPlaybackContent()
            1 -> showInfoContent()
            2 -> showLogsContent()
        }
    }

    private fun showPlaybackContent() {
        contentContainer.removeAllViews()
        contentContainer.addView(playbackContent)
        refreshPlaybackTab()
    }

    private fun showInfoContent() {
        contentContainer.removeAllViews()
        contentContainer.addView(infoContent)
        refreshInfoTab()
    }

    private fun showLogsContent() {
        contentContainer.removeAllViews()
        contentContainer.addView(logsTabContent)
        refreshLogsTab()
    }

    // MARK: - Playback Tab

    private fun setupPlaybackTab() {
        playbackContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun refreshPlaybackTab() {
        playbackContent.removeAllViews()

        val service = playbackService
        val player = service?.getPlayer()

        val nowPlayingSection = sectionHeader("NOW PLAYING")
        playbackContent.addView(nowPlayingSection)

        val title = player?.currentMediaItem?.mediaMetadata?.title?.toString() ?: "(idle)"
        val artist = player?.currentMediaItem?.mediaMetadata?.artist?.toString() ?: ""
        val display = if (artist.isEmpty()) title else "$title — $artist"
        playbackContent.addView(kvRow("Track", display))

        val cur = formatTime(if (player != null) player.currentPosition / 1000.0 else 0.0)
        val dur = formatTime(if (player != null && player.duration != C.TIME_UNSET) player.duration / 1000.0 else 0.0)
        val buf = formatTime(if (player != null) player.bufferedPosition / 1000.0 else 0.0)
        playbackContent.addView(kvRow("Time", "$cur / $dur  buf:$buf"))

        val kind = if (service?.isQueueEngineActive == true) "queue" else "single"
        val repeatMode = service?.queueEngine?.loopState?.value ?: "off"
        val shuffle = if (service?.queueEngine?.isShuffleActive == true) "on" else "off"
        playbackContent.addView(kvRow("Mode", "${kind} repeat:${repeatMode} shuffle:${shuffle}"))

        playbackContent.addView(controlsRow())

        // Queue
        val contextSongs = service?.queueEngine?.contextSongs ?: emptyList()
        val userQueue = service?.queueEngine?.userQueue ?: emptyList()
        val currentIndex = service?.queueEngine?.currentIndex ?: 0
        val isInUserQueue = service?.queueEngine?.isInUserQueue ?: false

        playbackContent.addView(sectionHeader("QUEUE (${contextSongs.size})"))
        if (contextSongs.isEmpty()) {
            playbackContent.addView(kvRow("", "empty", secondary = true))
        } else {
            contextSongs.forEachIndexed { i, song ->
                val isCurrent = !isInUserQueue && i == currentIndex
                playbackContent.addView(queueRow(song, isCurrent))
            }
        }

        if (userQueue.isNotEmpty()) {
            playbackContent.addView(sectionHeader("USER QUEUE (${userQueue.size})"))
            userQueue.forEachIndexed { i, song ->
                playbackContent.addView(queueRow(song, false))
            }
        }
    }

    private fun controlsRow(): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(8))
        }

        val prevBtn = Button(this).apply {
            text = "<<"
            setOnClickListener {
                val service = playbackService
                if (service != null && service.isQueueEngineActive) {
                    val player = service.getPlayer()
                    val currentTime = if (player != null) player.currentPosition / 1000.0 else 0.0
                    service.queueEngine.skipToPrevious(currentTime)
                }
            }
        }
        row.addView(prevBtn)

        val player = playbackService?.getPlayer()
        val isPlaying = player?.isPlaying == true
        val playPauseBtn = Button(this).apply {
            text = if (isPlaying) "||" else ">"
            setOnClickListener {
                val p = playbackService?.getPlayer()
                if (p?.isPlaying == true) {
                    p.pause()
                } else {
                    p?.play()
                }
            }
        }
        row.addView(playPauseBtn)

        val nextBtn = Button(this).apply {
            text = ">>"
            setOnClickListener {
                val service = playbackService
                if (service != null && service.isQueueEngineActive) {
                    service.queueEngine.skipToNext()
                }
            }
        }
        row.addView(nextBtn)

        return row
    }

    private fun queueRow(song: QueueSong, isCurrent: Boolean): View {
        val prefix = if (isCurrent) "▶ " else "  "
        return kvRow("$prefix${song.title}", formatTime(song.duration))
    }

    // MARK: - Info Tab

    private fun setupInfoTab() {
        infoContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun refreshInfoTab() {
        infoContent.removeAllViews()

        val service = playbackService
        val player = service?.getPlayer()

        // Buffer
        infoContent.addView(sectionHeader("BUFFER"))
        val bufferEmpty = player?.playbackState == Player.STATE_BUFFERING
        val isReady = player?.playbackState == Player.STATE_READY
        val status = when {
            bufferEmpty -> "BUFFERING"
            isReady -> "OK"
            else -> "IDLE"
        }
        val statusColor = when {
            bufferEmpty -> 0xFFEF4444.toInt()
            isReady -> 0xFF22C55E.toInt()
            else -> 0xFF9CA3AF.toInt()
        }
        infoContent.addView(kvRow("Status", status, valueColor = statusColor))

        val bufferedSec = if (player != null) player.bufferedPosition / 1000.0 else 0.0
        infoContent.addView(kvRow("Buffered", formatTime(bufferedSec)))
        infoContent.addView(kvRow("Recovery", "idle"))

        // Connection
        infoContent.addView(sectionHeader("CONNECTION"))
        val creds = credentialStore.retrieve()
        if (creds != null) {
            infoContent.addView(kvRow("Server", creds.serverUrl))
            infoContent.addView(kvRow("User", creds.username))
            infoContent.addView(kvRow("Auth", "${creds.authType} · ${creds.protocolVersion}"))
            val typeInfo = creds.serverType + if (!creds.fallbackUrl.isNullOrBlank()) " +fallback" else ""
            infoContent.addView(kvRow("Type", typeInfo))
        } else {
            infoContent.addView(kvRow("Status", "no credentials", secondary = true))
        }

        // System
        infoContent.addView(sectionHeader("SYSTEM"))

        val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val vol = if (am != null) {
            val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val cur = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            if (max > 0) "${cur}/${max}" else "?"
        } else "?"
        infoContent.addView(kvRow("Volume", vol))

        val memUsage = memoryUsageMB()
        infoContent.addView(kvRow("Memory", String.format("%.1f MB", memUsage)))

        val sdkInfo = "API ${Build.VERSION.SDK_INT} (${Build.VERSION.RELEASE})"
        infoContent.addView(kvRow("Android", sdkInfo))
        infoContent.addView(kvRow("Device", "${Build.MANUFACTURER} ${Build.MODEL}"))
    }

    private fun memoryUsageMB(): Double {
        val runtime = Runtime.getRuntime()
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024.0 * 1024.0)
    }

    // MARK: - Logs Tab

    private fun setupLogsTab() {
        logsTabContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        // Search bar
        searchEditText = EditText(this).apply {
            hint = "Search logs..."
            setTextSize(14f)
            setPadding(dp(8), dp(4), dp(8), dp(4))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    searchText = s?.toString() ?: ""
                    applyLogFilter()
                }
            })
        }
        logsTabContent.addView(searchEditText)

        // Filter chips (horizontal scroll)
        val filterScroll = HorizontalScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            isHorizontalScrollBarEnabled = false
        }
        filterContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        filterScroll.addView(filterContainer)
        logsTabContent.addView(filterScroll)

        // Log entries
        logsScrollView = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        logsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        logsScrollView.addView(logsContainer)
        logsTabContent.addView(logsScrollView)

        // Bottom action bar
        val actionBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(8), 0, 0)
        }
        Button(this).apply {
            text = "Select"
            setOnClickListener {
                isSelectingLogs = true
                selectedLogIndices.clear()
                refreshLogsTab()
            }
        }.let { actionBar.addView(it) }
        Button(this).apply {
            text = "Copy"
            setOnClickListener {
                if (isSelectingLogs && selectedLogIndices.isNotEmpty()) {
                    val entries = getFilteredEntries()
                    val text = selectedLogIndices.sorted().mapNotNull { idx ->
                        entries.getOrNull(idx)?.let { entry ->
                            val time = copyTimeFormatter.format(Date(entry.timestamp))
                            val src = if (entry.source.isEmpty()) "" else "[${entry.source}] "
                            "$time ${entry.level.name} $src${entry.message}"
                        }
                    }.joinToString("\n")
                    copyToClipboard(text)
                    isSelectingLogs = false
                    selectedLogIndices.clear()
                    refreshLogsTab()
                }
            }
        }.let { actionBar.addView(it) }
        Button(this).apply {
            text = "Clear"
            setOnClickListener {
                NativeLogger.clear()
                refreshLogsTab()
            }
        }.let { actionBar.addView(it) }
        logsTabContent.addView(actionBar)
    }

    private fun refreshLogsTab() {
        updateSources()
        rebuildFilterChips()
        refreshLogEntries()
    }

    private fun updateSources() {
        val entries = NativeLogger.getEntries()
        val sources = entries.mapNotNull { it.source.ifEmpty { null } }.toSet()
        val sorted = sources.sorted()
        if (sorted != allSources) {
            allSources = sorted
            if (activeSources.isEmpty()) {
                activeSources = sources.toMutableSet()
            }
        }
    }

    private fun getFilteredEntries(): List<NativeLogger.Entry> {
        val allEntries = NativeLogger.getEntries().reversed()
        return allEntries.filter { entry ->
            if (!activeLevels.contains(entry.level)) return@filter false
            if (activeSources.isNotEmpty() && entry.source.isNotEmpty()) {
                if (!activeSources.contains(entry.source)) return@filter false
            }
            if (searchText.isNotEmpty()) {
                val haystack = "${entry.source} ${entry.message}".lowercase()
                if (!haystack.contains(searchText.lowercase())) return@filter false
            }
            true
        }
    }

    private var lastFilteredEntries: List<NativeLogger.Entry> = emptyList()

    private fun applyLogFilter() {
        refreshLogEntries()
    }

    private fun refreshLogEntries() {
        val filtered = getFilteredEntries()
        lastFilteredEntries = filtered
        logsContainer.removeAllViews()

        val totalCount = NativeLogger.getEntries().size
        val headerText = "LOGS (${filtered.size}/$totalCount)"
        val header = TextView(this).apply {
            text = headerText
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, dp(4), 0, dp(4))
        }
        logsContainer.addView(header)

        if (filtered.isEmpty()) {
            logsContainer.addView(kvRow("", "no entries", secondary = true))
            return
        }

        filtered.forEachIndexed { index, entry ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                setPadding(dp(4), dp(2), dp(4), dp(2))
                setOnClickListener {
                    if (isSelectingLogs) {
                        if (selectedLogIndices.contains(index)) {
                            selectedLogIndices.remove(index)
                        } else {
                            selectedLogIndices.add(index)
                        }
                        refreshLogEntries()
                    }
                }
                setOnLongClickListener {
                    if (!isSelectingLogs) {
                        entry.let { e ->
                            val time = copyTimeFormatter.format(Date(e.timestamp))
                            val src = if (e.source.isEmpty()) "" else "[${e.source}] "
                            copyToClipboard("$time ${e.level.name} $src${e.message}")
                        }
                        true
                    } else {
                        false
                    }
                }
                setBackgroundColor(if (isSelectingLogs && selectedLogIndices.contains(index)) 0xFF1E3A5F.toInt() else 0x00000000)
            }

            val checkMark = TextView(this).apply {
                text = if (isSelectingLogs && selectedLogIndices.contains(index)) "☑ " else "  "
                textSize = 11f
                visibility = if (isSelectingLogs) android.view.View.VISIBLE else android.view.View.GONE
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
            row.addView(checkMark)

            val time = timeFormatter.format(Date(entry.timestamp))
            val src = if (entry.source.isEmpty()) "" else "[${entry.source}] "
            val prefix = "$time ${entry.level.name} $src"
            val textColor = when (entry.level) {
                NativeLogger.Entry.Level.ERROR -> 0xFFEF4444.toInt()
                NativeLogger.Entry.Level.WARN -> 0xFFF59E0B.toInt()
                NativeLogger.Entry.Level.DEBUG -> 0xFF9CA3AF.toInt()
                NativeLogger.Entry.Level.INFO -> 0xFFD1D5DB.toInt()
            }

            val textView = TextView(this).apply {
                text = prefix
                textSize = 10f
                setTypeface(android.graphics.Typeface.MONOSPACE)
                setTextColor(textColor)
                maxLines = 1
            }
            row.addView(textView)

            val msgView = TextView(this).apply {
                text = entry.message
                textSize = 11f
                setTypeface(android.graphics.Typeface.MONOSPACE)
                maxLines = 2
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
            row.addView(msgView)

            logsContainer.addView(row)
        }
    }

    private fun rebuildFilterChips() {
        filterContainer.removeAllViews()

        for (level in NativeLogger.Entry.Level.entries) {
            val chip = makeChip(level.name, activeLevels.contains(level))
            chip.setOnClickListener {
                if (activeLevels.contains(level)) {
                    activeLevels.remove(level)
                } else {
                    activeLevels.add(level)
                }
                rebuildFilterChips()
                applyLogFilter()
            }
            filterContainer.addView(chip)
        }

        val separator = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(1), ViewGroup.LayoutParams.MATCH_PARENT)
            setBackgroundColor(0xFF4B5563.toInt())
        }
        filterContainer.addView(separator)

        for (source in allSources) {
            val chip = makeChip(source, activeSources.contains(source))
            chip.setOnClickListener {
                if (activeSources.contains(source)) {
                    activeSources.remove(source)
                } else {
                    activeSources.add(source)
                }
                rebuildFilterChips()
                applyLogFilter()
            }
            filterContainer.addView(chip)
        }
    }

    private fun makeChip(title: String, isActive: Boolean): Button {
        return Button(this).apply {
            text = title
            textSize = 11f
            setPadding(dp(8), dp(2), dp(8), dp(2))
            setTextColor(if (isActive) 0xFFFFFFFF.toInt() else 0xFF9CA3AF.toInt())
            setBackgroundColor(if (isActive) 0xFF3B82F6.toInt() else 0xFF374151.toInt())
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(dp(2), 0, dp(2), 0) }
        }
    }

    private fun copyToClipboard(text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("debug_log", text))
    }

    // MARK: - Common UI Helpers

    private fun sectionHeader(title: String): View {
        return TextView(this).apply {
            text = title
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, dp(12), 0, dp(4))
        }
    }

    private fun kvRow(key: String, value: String, secondary: Boolean = false, valueColor: Int? = null): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(0, dp(3), 0, dp(3))
        }

        TextView(this).apply {
            text = key
            textSize = 12f
            setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD)
            setTextColor(if (secondary) 0xFF6B7280.toInt() else 0xFF9CA3AF.toInt())
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }.let { row.addView(it) }

        val space = TextView(this).apply {
            text = "  "
            layoutParams = LinearLayout.LayoutParams(
                dp(8),
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        row.addView(space)

        TextView(this).apply {
            text = value
            textSize = 12f
            setTypeface(android.graphics.Typeface.MONOSPACE)
            if (valueColor != null) setTextColor(valueColor)
            layoutParams = LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            )
        }.let { row.addView(it) }

        return row
    }

    private fun formatTime(seconds: Double): String {
        if (seconds.isNaN() || seconds.isInfinite() || seconds < 0) return "--:--"
        val mins = seconds.toInt() / 60
        val secs = seconds.toInt() % 60
        return String.format("%d:%02d", mins, secs)
    }

    // MARK: - Service Binding

    private fun bindPlaybackService() {
        val intent = Intent(this, PlaybackService::class.java)
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    // MARK: - Auto Refresh

    private fun startAutoRefresh() {
        refreshTimer = Handler(Looper.getMainLooper())
        refreshTimer?.post(object : Runnable {
            override fun run() {
                refreshCurrentTab()
                refreshTimer?.postDelayed(this, 2000)
            }
        })
    }

    private fun stopAutoRefresh() {
        refreshTimer?.removeCallbacksAndMessages(null)
        refreshTimer = null
    }

    private fun refreshCurrentTab() {
        when (currentTab) {
            0 -> refreshPlaybackTab()
            1 -> refreshInfoTab()
            2 -> refreshLogsTab()
        }
    }
}
