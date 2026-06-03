package github.realtvop.aonsoku.plugins.data

import android.util.Base64
import github.realtvop.aonsoku.plugins.data.image.ImageCacheUtils
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.MockedStatic
import org.mockito.Mockito

class ImageCacheUtilsTest {
    private lateinit var mockedBase64: MockedStatic<Base64>

    @Before
    fun setUp() {
        mockedBase64 = Mockito.mockStatic(Base64::class.java)
        mockedBase64.`when`<String> { 
            Base64.encodeToString(Mockito.any(ByteArray::class.java), Mockito.anyInt()) 
        }.thenAnswer { invocation ->
            val input = invocation.getArgument<ByteArray>(0)
            java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(input)
        }
    }

    @After
    fun tearDown() {
        mockedBase64.close()
    }

    @Test
    fun cacheIdIsBase64UrlSafeNoPadding() {
        val id = ImageCacheUtils.cacheId(forCoverArtId = "al-123")
        assertNotNull(id)
        assertFalse(id.contains("+"))
        assertFalse(id.contains("/"))
        assertFalse(id.contains("="))
    }

    @Test
    fun cacheIdIsDeterministic() {
        val a = ImageCacheUtils.cacheId(forCoverArtId = "test-id")
        val b = ImageCacheUtils.cacheId(forCoverArtId = "test-id")
        assertEquals(a, b)
    }

    @Test
    fun differentIdsProduceDifferentCacheIds() {
        val a = ImageCacheUtils.cacheId(forCoverArtId = "id-1")
        val b = ImageCacheUtils.cacheId(forCoverArtId = "id-2")
        assertTrue(a != b)
    }

    @Test
    fun fileExtensionReturnsJpgForJpeg() {
        assertEquals("jpg", ImageCacheUtils.fileExtension(forContentType = "image/jpeg"))
    }

    @Test
    fun fileExtensionReturnsPngForPng() {
        assertEquals("png", ImageCacheUtils.fileExtension(forContentType = "image/png"))
    }

    @Test
    fun fileExtensionReturnsWebpForWebp() {
        assertEquals("webp", ImageCacheUtils.fileExtension(forContentType = "image/webp"))
    }

    @Test
    fun fileExtensionReturnsGifForGif() {
        assertEquals("gif", ImageCacheUtils.fileExtension(forContentType = "image/gif"))
    }

    @Test
    fun fileExtensionDefaultsToJpg() {
        assertEquals("jpg", ImageCacheUtils.fileExtension(forContentType = "application/octet-stream"))
    }

    @Test
    fun fileExtensionStripsParameters() {
        assertEquals("jpg", ImageCacheUtils.fileExtension(forContentType = "image/jpeg; charset=utf-8"))
    }
}
