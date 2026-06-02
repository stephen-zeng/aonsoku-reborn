package github.realtvop.aonsoku.plugins.audio

import android.content.Context

import github.realtvop.aonsoku.plugins.bridge.AndroidCredentialStore
import github.realtvop.aonsoku.plugins.bridge.SubsonicAuthBuilder
import java.io.File
import java.net.URL
import java.net.URLEncoder

class NativeSourceResolver(
    private val context: Context,
    private val credentialStore: AndroidCredentialStore = AndroidCredentialStore(context)
) {
    private val cacheDirectories = listOf(
        AudioCacheUtils.getCacheDirectory(context),
        AudioCacheUtils.getSecondaryCacheDirectory(context)
    )

    fun resolveSource(song: QueueSong): Pair<String, String>? {
        // 1. If song.cachedFileUri is provided, check if it exists on disk
        if (!song.cachedFileUri.isNullOrEmpty()) {
            val path = if (song.cachedFileUri.startsWith("file://")) {
                song.cachedFileUri.substring(7)
            } else {
                song.cachedFileUri
            }
            val file = File(path)
            if (file.exists()) {
                return Pair("file://${file.absolutePath}", "native-file")
            }
        }

        // 2. Check if the file is in local cache directories
        val cacheId = AudioCacheUtils.cacheId(song.id)
        val extensions = listOf("mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "audio")
        for (directory in cacheDirectories) {
            if (directory.exists() && directory.isDirectory) {
                for (ext in extensions) {
                    val file = File(directory, "$cacheId.$ext")
                    if (file.exists()) {
                        return Pair("file://${file.absolutePath}", "native-file")
                    }
                }
            }
        }

        // 3. Fallback to stream URL
        var effectiveSongId = song.id
        if (song.streamUrl.startsWith("aonsoku-media://stream")) {
            val idIndex = song.streamUrl.indexOf("id=")
            if (idIndex != -1) {
                var idVal = song.streamUrl.substring(idIndex + 3)
                val ampersandIndex = idVal.indexOf("&")
                if (ampersandIndex != -1) {
                    idVal = idVal.substring(0, ampersandIndex)
                }
                if (idVal.isNotEmpty()) {
                    effectiveSongId = idVal
                }
            }
        }

        val credentials = credentialStore.retrieve()
        if (credentials != null) {
            val cleanBaseUrl = credentials.serverUrl.trimEnd('/')
            val authParams = SubsonicAuthBuilder.buildQueryParams(
                username = credentials.username,
                password = credentials.password,
                authType = credentials.authType,
                protocolVersion = credentials.protocolVersion
            )
            val extraParams = mapOf(
                "id" to effectiveSongId,
                "estimateContentLength" to "true"
            )
            val allParams = authParams + extraParams
            val queryString = allParams.entries.joinToString("&") { (k, v) ->
                "${URLEncoder.encode(k, "UTF-8")}=${URLEncoder.encode(v, "UTF-8")}"
            }
            return Pair("$cleanBaseUrl/rest/stream?$queryString", "stream")
        }

        // If no credentials, check if streamUrl itself is a valid HTTP/HTTPS URL
        if (song.streamUrl.startsWith("http://") || song.streamUrl.startsWith("https://")) {
            return Pair(song.streamUrl, "stream")
        }

        return null
    }
}
