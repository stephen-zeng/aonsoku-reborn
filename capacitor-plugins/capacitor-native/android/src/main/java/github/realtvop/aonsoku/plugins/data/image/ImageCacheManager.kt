package github.realtvop.aonsoku.plugins.data.image

import github.realtvop.aonsoku.plugins.bridge.ServerCredentials
import github.realtvop.aonsoku.plugins.bridge.SubsonicAuthBuilder
import github.realtvop.aonsoku.plugins.data.db.dao.CacheMetaDao
import github.realtvop.aonsoku.plugins.data.db.entity.CacheMetaEntity
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

class ImageCacheManager(private val cacheDir: File, private val cacheMetaDao: CacheMetaDao) {
    private val client = OkHttpClient.Builder().connectTimeout(30, TimeUnit.SECONDS).readTimeout(120, TimeUnit.SECONDS).build()

    suspend fun downloadCoverImage(coverArtId: String, size: String, credentials: ServerCredentials): File {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, true); val cid = ImageCacheUtils.cacheId(coverArtId)
        dir.listFiles { f -> f.name.startsWith("$cid.") }?.forEach { it.delete() }
        val p = SubsonicAuthBuilder.buildQueryParams(credentials.username, credentials.password, credentials.authType, credentials.protocolVersion).toMutableMap().apply { put("id", coverArtId); put("size", size) }
        val url = "${credentials.serverUrl.trimEnd('/')}/rest/getCoverArt?${p.entries.joinToString("&") { (k, v) -> "${java.net.URLEncoder.encode(k, "UTF-8")}=${java.net.URLEncoder.encode(v, "UTF-8")}" }}"
        val resp = client.newCall(Request.Builder().url(url).get().build()).execute()
        if (!resp.isSuccessful) throw ImageCacheError.DownloadFailed(Exception("HTTP ${resp.code}"))
        val ct = resp.header("Content-Type", "image/jpeg") ?: "image/jpeg"; val ext = ImageCacheUtils.fileExtension(ct)
        val data = resp.body?.bytes() ?: throw ImageCacheError.DownloadFailed(Exception("Empty body"))
        val file = File(dir, "$cid.$ext"); file.writeBytes(data)
        val now = System.currentTimeMillis()
        cacheMetaDao.upsert(CacheMetaEntity("cover:$coverArtId", coverArtId, "cover", "explicit", coverSize = size, sizeBytes = data.size.toLong(), cachedAt = now, lastAccessedAt = now))
        return file
    }

    suspend fun storeCoverImage(coverArtId: String, data: ByteArray, contentType: String, coverSize: String): File {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, true); val cid = ImageCacheUtils.cacheId(coverArtId); val ext = ImageCacheUtils.fileExtension(contentType)
        val file = File(dir, "$cid.$ext"); dir.listFiles { f -> f.name.startsWith("$cid.") }?.forEach { it.delete() }; file.writeBytes(data)
        val now = System.currentTimeMillis()
        cacheMetaDao.upsert(CacheMetaEntity("cover:$coverArtId", coverArtId, "cover", "explicit", coverSize = coverSize, sizeBytes = data.size.toLong(), cachedAt = now, lastAccessedAt = now))
        return file
    }

    suspend fun resolveCoverImage(coverArtId: String): File? {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, false); if (!dir.exists()) return null
        val cid = ImageCacheUtils.cacheId(coverArtId); val f = dir.listFiles { f -> f.name.startsWith("$cid.") }?.firstOrNull() ?: return null
        if (!f.exists()) return null
        try { cacheMetaDao.getByKey("cover:$coverArtId")?.let { cacheMetaDao.upsert(it.copy(lastAccessedAt = System.currentTimeMillis())) } } catch (_: Exception) {}
        return f
    }

    suspend fun deleteCoverImage(coverArtId: String): Boolean {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, false); if (!dir.exists()) return false; val cid = ImageCacheUtils.cacheId(coverArtId)
        var d = false; dir.listFiles { f -> f.name.startsWith("$cid.") }?.forEach { it.delete(); d = true }
        try { cacheMetaDao.delete("cover:$coverArtId") } catch (_: Exception) {}; return d
    }

    suspend fun clearCoverImages(): Int {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, false); if (!dir.exists()) return 0
        val files = dir.listFiles() ?: return 0; files.forEach { it.delete() }
        try { cacheMetaDao.deleteByType("cover") } catch (_: Exception) {}; return files.size
    }

    suspend fun getCoverImageSize(coverArtId: String): Pair<Long, String?>? {
        val dir = ImageCacheUtils.cacheDirectory(cacheDir, false); val cid = ImageCacheUtils.cacheId(coverArtId)
        val f = dir.listFiles { f -> f.name.startsWith("$cid.") }?.firstOrNull() ?: return null; if (!f.exists()) return null
        val r = try { cacheMetaDao.getByKey("cover:$coverArtId") } catch (_: Exception) { null }
        return Pair(f.length(), r?.coverSize)
    }
}