package github.realtvop.aonsoku.plugins.audio

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlaybackServiceManifestTest {
    @Test
    fun testPlaybackServiceIsResolvable() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        val intent = Intent(appContext, PlaybackService::class.java)
        val resolveInfo = appContext.packageManager.resolveService(intent, 0)
        assertNotNull("PlaybackService should be registered and resolvable in AndroidManifest", resolveInfo)
    }
}
