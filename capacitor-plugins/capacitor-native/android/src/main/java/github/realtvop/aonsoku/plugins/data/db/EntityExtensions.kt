package github.realtvop.aonsoku.plugins.data.db

import com.getcapacitor.JSObject
import github.realtvop.aonsoku.plugins.data.db.entity.*
import org.json.JSONArray
import org.json.JSONObject

fun ArtistEntity.toJSObject(): JSObject = JSObject().apply {
    put("id", id); put("name", name); put("albumCount", albumCount)
    for ((k,v) in mapOf("coverArt" to coverArt, "artistImageUrl" to artistImageUrl, "starred" to starred)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    if (starredAt != null) put("starredAt", starredAt) else put("starredAt", JSONObject.NULL)
}

fun AlbumEntity.toJSObject(): JSObject = JSObject().apply {
    put("id", id); put("name", name); put("artist", artist); put("songCount", songCount); put("duration", duration)
    for ((k,v) in mapOf("artistId" to artistId, "coverArt" to coverArt, "genre" to genre, "created" to created, "played" to played, "starred" to starred)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    for ((k,v) in mapOf("year" to year, "playCount" to playCount)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    if (starredAt != null) put("starredAt", starredAt) else put("starredAt", JSONObject.NULL)
}

fun SongEntity.toJSObject(): JSObject = JSObject().apply {
    put("id", id); put("title", title); put("duration", duration)
    for ((k,v) in mapOf("parent" to parent, "album" to album, "artist" to artist, "genre" to genre, "coverArt" to coverArt, "contentType" to contentType, "suffix" to suffix, "path" to path, "created" to created, "albumId" to albumId, "artistId" to artistId, "played" to played, "starred" to starred, "comment" to comment, "sortName" to sortName, "mediaType" to mediaType, "musicBrainzId" to musicBrainzId)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    for ((k,v) in mapOf("track" to track, "year" to year, "bitRate" to bitRate, "playCount" to playCount, "discNumber" to discNumber, "bpm" to bpm)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    for ((k,v) in mapOf("size" to size, "starredAt" to starredAt, "playedAt" to playedAt)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    try { if (genresJson != null) put("genres", JSONArray(genresJson)) } catch (_: Exception) {}
    try { if (replayGainJson != null) put("replayGain", JSONObject(replayGainJson)) } catch (_: Exception) {}
}

fun PlaylistEntity.toJSObject(): JSObject = JSObject().apply {
    put("id", id); put("name", name); put("songCount", songCount); put("duration", duration); put("isPublic", isPublic)
    for ((k,v) in mapOf("comment" to comment, "owner" to owner, "created" to created, "changed" to changed, "coverArt" to coverArt, "starred" to starred)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    if (starredAt != null) put("starredAt", starredAt) else put("starredAt", JSONObject.NULL)
}

fun PlaylistDetailEntity.toJSObject(): JSObject = JSObject().apply {
    put("id", id); put("name", name); put("songCount", songCount); put("duration", duration); put("isPublic", isPublic)
    for ((k,v) in mapOf("comment" to comment, "owner" to owner, "created" to created, "changed" to changed, "coverArt" to coverArt, "starred" to starred)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
    if (starredAt != null) put("starredAt", starredAt) else put("starredAt", JSONObject.NULL)
    try { put("entry", JSONArray(entriesJson)) } catch (_: Exception) {}
}

fun GenreEntity.toJSObject(): JSObject = JSObject().apply {
    put("value", value)
    for ((k,v) in mapOf("songCount" to songCount, "albumCount" to albumCount)) if (v != null) put(k, v) else put(k, JSONObject.NULL)
}

fun LyricsEntity.toJSObject(): JSObject = JSObject().apply {
    put("songId", songId); put("content", content); put("cachedAt", cachedAt); put("lastAccessedAt", lastAccessedAt)
    if (synced != null) put("synced", synced) else put("synced", JSONObject.NULL)
}

internal fun List<JSObject>.toJSArray(): JSONArray { val a = JSONArray(); forEach { a.put(it) }; return a }
