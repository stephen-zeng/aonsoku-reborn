use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

const AUDIO_CACHE_DIR: &str = "audio-cache";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCacheStoreAudioFilePayload {
    song_id: String,
    data_base64: String,
    content_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCacheAudioFilePayload {
    song_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCachedAudioFile {
    song_id: String,
    uri: String,
    content_type: Option<String>,
    size_bytes: Option<u64>,
    last_modified_at: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopResolveAudioFileResult {
    file: Option<DesktopCachedAudioFile>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioFileSizeResult {
    size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDeleteAudioFileResult {
    deleted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopClearAudioFilesResult {
    deleted_count: u64,
}

#[tauri::command]
pub fn desktop_cache_store_audio_file(
    app: AppHandle,
    payload: DesktopCacheStoreAudioFilePayload,
) -> Result<DesktopCachedAudioFile, String> {
    let data = general_purpose::STANDARD
        .decode(payload.data_base64.as_bytes())
        .map_err(|error| format!("invalid audio cache payload: {error}"))?;

    store_audio_bytes(&app, &payload.song_id, data, &payload.content_type)
}

/// Persist raw audio bytes to the on-disk cache using the same directory
/// layout and naming as [`desktop_cache_store_audio_file`]. Shared by the
/// explicit-download command and the desktop stream "cache while playing"
/// path so both write files that [`desktop_cache_resolve_audio_file`] can
/// find later.
pub(crate) fn store_audio_bytes(
    app: &AppHandle,
    song_id: &str,
    data: Vec<u8>,
    content_type: &str,
) -> Result<DesktopCachedAudioFile, String> {
    let dir = audio_cache_dir(app)?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let prefix = audio_file_prefix(song_id);
    delete_audio_files_for_song(&dir, &prefix)?;

    let extension = audio_extension(content_type);
    let path = dir.join(format!("{prefix}.{extension}"));
    fs::write(&path, data).map_err(|error| error.to_string())?;

    cached_audio_file_from_path(song_id, &path, Some(content_type.to_string()))
}

/// Returns `true` when an audio file for `song_id` already exists in the
/// cache. Used by the stream cache path to avoid re-writing a song that was
/// already cached (e.g. via an explicit download).
pub(crate) fn is_audio_file_cached(app: &AppHandle, song_id: &str) -> bool {
    let Ok(dir) = audio_cache_dir(app) else {
        return false;
    };
    let prefix = audio_file_prefix(song_id);
    matches!(find_audio_file(&dir, &prefix), Ok(Some(_)))
}

#[tauri::command]
pub fn desktop_cache_resolve_audio_file(
    app: AppHandle,
    payload: DesktopCacheAudioFilePayload,
) -> Result<DesktopResolveAudioFileResult, String> {
    let dir = audio_cache_dir(&app)?;
    let prefix = audio_file_prefix(&payload.song_id);
    let file = match find_audio_file(&dir, &prefix)? {
        Some(path) => Some(cached_audio_file_from_path(
            &payload.song_id,
            &path,
            content_type_from_path(&path),
        )?),
        None => None,
    };

    Ok(DesktopResolveAudioFileResult { file })
}

#[tauri::command]
pub fn desktop_cache_get_audio_file_size(
    app: AppHandle,
    payload: DesktopCacheAudioFilePayload,
) -> Result<DesktopAudioFileSizeResult, String> {
    let dir = audio_cache_dir(&app)?;
    let prefix = audio_file_prefix(&payload.song_id);
    let size_bytes = match find_audio_file(&dir, &prefix)? {
        Some(path) => Some(file_size(&path)?),
        None => None,
    };

    Ok(DesktopAudioFileSizeResult { size_bytes })
}

#[tauri::command]
pub fn desktop_cache_delete_audio_file(
    app: AppHandle,
    payload: DesktopCacheAudioFilePayload,
) -> Result<DesktopDeleteAudioFileResult, String> {
    let dir = audio_cache_dir(&app)?;
    let prefix = audio_file_prefix(&payload.song_id);
    let deleted_count = delete_audio_files_for_song(&dir, &prefix)?;

    Ok(DesktopDeleteAudioFileResult {
        deleted: deleted_count > 0,
    })
}

#[tauri::command]
pub fn desktop_cache_clear_audio_files(
    app: AppHandle,
) -> Result<DesktopClearAudioFilesResult, String> {
    let dir = audio_cache_dir(&app)?;
    let deleted_count = delete_audio_cache_dir(&dir)?;

    Ok(DesktopClearAudioFilesResult { deleted_count })
}

fn audio_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join(AUDIO_CACHE_DIR))
}

fn audio_file_prefix(song_id: &str) -> String {
    let encoded = general_purpose::URL_SAFE_NO_PAD.encode(song_id.as_bytes());
    if encoded.is_empty() {
        "empty-song-id".to_string()
    } else {
        encoded
    }
}

fn audio_extension(content_type: &str) -> &'static str {
    let content_type = content_type
        .split(';')
        .next()
        .unwrap_or(content_type)
        .trim()
        .to_ascii_lowercase();

    match content_type.as_str() {
        "audio/aac" => "aac",
        "audio/flac" | "audio/x-flac" => "flac",
        "audio/mp4" | "audio/x-m4a" => "m4a",
        "audio/mpeg" | "audio/mp3" => "mp3",
        "audio/ogg" => "ogg",
        "audio/opus" => "opus",
        "audio/wav" | "audio/wave" | "audio/x-wav" => "wav",
        _ => "audio",
    }
}

fn content_type_from_path(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let content_type = match extension.as_str() {
        "aac" => "audio/aac",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "opus" => "audio/opus",
        "wav" => "audio/wav",
        _ => return None,
    };

    Some(content_type.to_string())
}

fn cached_audio_file_from_path(
    song_id: &str,
    path: &Path,
    content_type: Option<String>,
) -> Result<DesktopCachedAudioFile, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;

    Ok(DesktopCachedAudioFile {
        song_id: song_id.to_string(),
        uri: file_uri(path)?,
        content_type,
        size_bytes: Some(metadata.len()),
        last_modified_at: metadata.modified().ok().and_then(|modified| {
            modified.duration_since(UNIX_EPOCH).ok().map(|duration| {
                let millis = duration.as_millis();
                millis.min(u64::MAX as u128) as u64
            })
        }),
    })
}

fn file_uri(path: &Path) -> Result<String, String> {
    url::Url::from_file_path(path)
        .map(|url| url.to_string())
        .map_err(|_| format!("invalid audio cache path: {}", path.display()))
}

fn file_size(path: &Path) -> Result<u64, String> {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .map_err(|error| error.to_string())
}

fn find_audio_file(dir: &Path, prefix: &str) -> Result<Option<PathBuf>, String> {
    if !dir.exists() {
        return Ok(None);
    }

    let prefix_with_dot = format!("{prefix}.");
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if file_name == prefix || file_name.starts_with(&prefix_with_dot) {
            return Ok(Some(path));
        }
    }

    Ok(None)
}

fn delete_audio_files_for_song(dir: &Path, prefix: &str) -> Result<u64, String> {
    if !dir.exists() {
        return Ok(0);
    }

    let prefix_with_dot = format!("{prefix}.");
    let mut deleted_count = 0;
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if file_name == prefix || file_name.starts_with(&prefix_with_dot) {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
            deleted_count += 1;
        }
    }

    Ok(deleted_count)
}

fn delete_audio_cache_dir(dir: &Path) -> Result<u64, String> {
    if !dir.exists() {
        return Ok(0);
    }

    let mut deleted_count = 0;
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_file() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
            deleted_count += 1;
        }
    }

    Ok(deleted_count)
}
