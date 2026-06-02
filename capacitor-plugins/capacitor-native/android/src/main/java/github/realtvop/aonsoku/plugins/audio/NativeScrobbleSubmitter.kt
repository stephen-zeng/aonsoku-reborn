package github.realtvop.aonsoku.plugins.audio

import github.realtvop.aonsoku.plugins.bridge.ServerCredentials
import github.realtvop.aonsoku.plugins.bridge.SubsonicHttpClient
import java.util.Date

class NativeScrobbleSubmitter(private val httpClient: SubsonicHttpClient) {
    private val thresholdPercent = 0.5
    private val thresholdMaxSeconds: Double = 240.0

    suspend fun sendNowPlaying(songId: String, credentials: ServerCredentials) {
        try {
            httpClient.request(
                baseUrl = credentials.serverUrl,
                path = "scrobble",
                credentials = credentials,
                extraQuery = mapOf(
                    "id" to songId,
                    "submission" to "false",
                    "time" to (Date().time * 1000).toLong().toString(),
                ),
            )
        } catch (_: Exception) {
            // Silently fail - scrobble is best-effort
        }
    }

    fun submitIfEligible(entry: ScrobbleEntry, songDurationSeconds: Double, credentials: ServerCredentials) {
        val playedSeconds = entry.playedDurationMs / 1000.0
        val threshold = minOf(songDurationSeconds * thresholdPercent, thresholdMaxSeconds)

        if (playedSeconds < threshold || threshold <= 0.0) return

        submitInternal(songId = entry.songId, timestamp = entry.timestamp, credentials = credentials)
    }

    suspend fun submitPending(buffer: NativeScrobbleBuffer, credentials: ServerCredentials) {
        val pendingEntries = buffer.getEntries()
        if (pendingEntries.isEmpty()) return

        val submittedIds = mutableSetOf<String>()
        for (entry in pendingEntries) {
            if (submitAsync(songId = entry.songId, timestamp = entry.timestamp, credentials = credentials)) {
                submittedIds.add(entry.songId)
            } else {
                break
            }
        }
        if (submittedIds.isNotEmpty()) {
            buffer.removeEntries(submittedIds)
        }
    }

    private fun submitInternal(songId: String, timestamp: Double, credentials: ServerCredentials) {
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            submitAsync(songId = songId, timestamp = timestamp, credentials = credentials)
        }
    }

    private suspend fun submitAsync(songId: String, timestamp: Double, credentials: ServerCredentials): Boolean {
        return try {
            httpClient.request(
                baseUrl = credentials.serverUrl,
                path = "scrobble",
                credentials = credentials,
                extraQuery = mapOf(
                    "id" to songId,
                    "submission" to "true",
                    "time" to timestamp.toLong().toString(),
                ),
            )
            true
        } catch (_: Exception) {
            false
        }
    }
}
