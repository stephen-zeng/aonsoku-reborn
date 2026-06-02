package github.realtvop.aonsoku.plugins.audio

import android.content.Context
import github.realtvop.aonsoku.plugins.bridge.AndroidCredentialStore
import github.realtvop.aonsoku.plugins.bridge.ServerCredentials
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.mockito.Mockito
import java.io.File

class NativeSourceResolverTest {

    @Rule
    @JvmField
    val tempFolder = TemporaryFolder()

    private fun createSong(id: String, streamUrl: String, cachedFileUri: String? = null): QueueSong {
        return QueueSong(
            id = id,
            title = "Song $id",
            artist = "Artist",
            artistId = null,
            album = "Album",
            albumId = null,
            duration = 180.0,
            coverArtId = null,
            streamUrl = streamUrl,
            cachedFileUri = cachedFileUri
        )
    }

    @Test
    fun testResolveCachedFileUri() {
        val context = Mockito.mock(Context::class.java)
        val filesDir = tempFolder.newFolder("files")
        val cacheDir = tempFolder.newFolder("cache")
        Mockito.`when`(context.filesDir).thenReturn(filesDir)
        Mockito.`when`(context.cacheDir).thenReturn(cacheDir)

        val cachedFile = File(filesDir, "test_cached_song.mp3")
        cachedFile.writeText("audio data")

        val song = createSong(
            id = "song-1",
            streamUrl = "http://stream/1",
            cachedFileUri = cachedFile.absolutePath
        )

        val credentialStore = Mockito.mock(AndroidCredentialStore::class.java)
        val resolver = NativeSourceResolver(context, credentialStore)
        val result = resolver.resolveSource(song)

        assertNotNull(result)
        assertEquals("native-file", result?.second)
        assertTrue(result?.first?.startsWith("file:/") ?: false)
    }

    @Test
    fun testResolveFromCacheDirectories() {
        val context = Mockito.mock(Context::class.java)
        val filesDir = tempFolder.newFolder("files")
        val cacheDir = tempFolder.newFolder("cache")
        Mockito.`when`(context.filesDir).thenReturn(filesDir)
        Mockito.`when`(context.cacheDir).thenReturn(cacheDir)

        val cacheId = AudioCacheUtils.cacheId("song-abc")
        // Create cached file under primary files cache directory
        val audioCacheDir = File(filesDir, AudioCacheUtils.CACHE_DIRECTORY_NAME).apply { mkdirs() }
        val cachedFile = File(audioCacheDir, "$cacheId.mp3")
        cachedFile.writeText("cached mp3 data")

        val song = createSong(
            id = "song-abc",
            streamUrl = "http://stream/abc"
        )

        val credentialStore = Mockito.mock(AndroidCredentialStore::class.java)
        val resolver = NativeSourceResolver(context, credentialStore)
        val result = resolver.resolveSource(song)

        assertNotNull(result)
        assertEquals("native-file", result?.second)
        assertTrue(result?.first?.contains("$cacheId.mp3") ?: false)
    }

    @Test
    fun testResolveAuthenticatedStreamUrl() {
        val context = Mockito.mock(Context::class.java)
        val filesDir = tempFolder.newFolder("files")
        val cacheDir = tempFolder.newFolder("cache")
        Mockito.`when`(context.filesDir).thenReturn(filesDir)
        Mockito.`when`(context.cacheDir).thenReturn(cacheDir)

        val credentialStore = Mockito.mock(AndroidCredentialStore::class.java)
        val credentials = ServerCredentials(
            serverUrl = "https://navidrome.example.com",
            username = "testuser",
            password = "testpassword",
            authType = "token",
            protocolVersion = "1.16.0",
            serverType = "subsonic",
            fallbackUrl = null
        )
        Mockito.`when`(credentialStore.retrieve()).thenReturn(credentials)

        val song = createSong(
            id = "song-stream-id",
            streamUrl = "aonsoku-media://stream?id=song-stream-id"
        )

        val resolver = NativeSourceResolver(context, credentialStore)
        val result = resolver.resolveSource(song)

        assertNotNull(result)
        assertEquals("stream", result?.second)
        val resolvedUrl = result?.first ?: ""
        assertTrue(resolvedUrl.startsWith("https://navidrome.example.com/rest/stream"))
        assertTrue(resolvedUrl.contains("u=testuser"))
        assertTrue(resolvedUrl.contains("id=song-stream-id"))
        assertTrue(resolvedUrl.contains("estimateContentLength=true"))
    }
}
