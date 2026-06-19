use std::{
    ffi::c_void,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
    SeekDirection,
};
use tauri::{Emitter, WebviewWindow};

const REMOTE_COMMAND_EVENT: &str = "media-remote-command";
const SEEK_STEP_SECONDS: f64 = 10.0;

#[derive(Default)]
pub struct MediaControlsState {
    controls: Mutex<Option<MediaControls>>,
    position_seconds: Arc<Mutex<f64>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionPayload {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    artwork_url: Option<String>,
    duration: Option<f64>,
    position: Option<f64>,
    playback_state: MediaPlaybackState,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
enum MediaPlaybackState {
    None,
    Playing,
    Paused,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaRemoteCommandPayload {
    command: &'static str,
    position: Option<f64>,
}

#[tauri::command]
pub fn media_update_session(
    window: WebviewWindow,
    state: tauri::State<'_, MediaControlsState>,
    payload: MediaSessionPayload,
) -> Result<(), String> {
    if matches!(payload.playback_state, MediaPlaybackState::None) {
        return media_clear_session(state);
    }

    if let Some(position) = payload.position.and_then(valid_seconds) {
        set_position(&state.position_seconds, position)?;
    }

    state.with_controls(&window, |controls| {
        controls.set_metadata(MediaMetadata {
            title: payload.title.as_deref(),
            album: payload.album.as_deref(),
            artist: payload.artist.as_deref(),
            cover_url: payload.artwork_url.as_deref(),
            duration: payload
                .duration
                .and_then(valid_seconds)
                .map(Duration::from_secs_f64),
        })?;

        controls.set_playback(media_playback_from_payload(&payload))?;

        Ok(())
    })
}

#[tauri::command]
pub fn media_clear_session(state: tauri::State<'_, MediaControlsState>) -> Result<(), String> {
    set_position(&state.position_seconds, 0.0)?;

    let mut controls = state
        .controls
        .lock()
        .map_err(|_| "media controls lock poisoned".to_string())?;

    if let Some(mut controls) = controls.take() {
        let _ = controls.detach();
    }

    Ok(())
}

impl MediaControlsState {
    fn with_controls<F>(&self, window: &WebviewWindow, op: F) -> Result<(), String>
    where
        F: FnOnce(&mut MediaControls) -> Result<(), souvlaki::Error>,
    {
        let mut controls = self
            .controls
            .lock()
            .map_err(|_| "media controls lock poisoned".to_string())?;

        if controls.is_none() {
            *controls = Some(create_media_controls(
                window,
                Arc::clone(&self.position_seconds),
            )?);
        }

        let controls = controls
            .as_mut()
            .ok_or_else(|| "media controls unavailable".to_string())?;

        op(controls).map_err(|error| error.to_string())
    }
}

fn create_media_controls(
    window: &WebviewWindow,
    position_seconds: Arc<Mutex<f64>>,
) -> Result<MediaControls, String> {
    let config = PlatformConfig {
        dbus_name: "aonsoku",
        display_name: "Aonsoku",
        hwnd: platform_hwnd(window)?,
    };

    let mut controls = MediaControls::new(config).map_err(|error| error.to_string())?;
    let event_window = window.clone();

    controls
        .attach(move |event| {
            handle_media_control_event(&event_window, &position_seconds, event);
        })
        .map_err(|error| error.to_string())?;

    Ok(controls)
}

fn handle_media_control_event(
    window: &WebviewWindow,
    position_seconds: &Arc<Mutex<f64>>,
    event: MediaControlEvent,
) {
    match event {
        MediaControlEvent::Play => emit_remote_command(window, "play", None),
        MediaControlEvent::Pause => emit_remote_command(window, "pause", None),
        MediaControlEvent::Toggle => {
            emit_remote_command(window, "togglePlayPause", None);
        }
        MediaControlEvent::Next => emit_remote_command(window, "next", None),
        MediaControlEvent::Previous => emit_remote_command(window, "previous", None),
        MediaControlEvent::Stop => emit_remote_command(window, "stop", None),
        MediaControlEvent::SetPosition(position) => {
            let seconds = position.0.as_secs_f64();
            let _ = set_position(position_seconds, seconds);
            emit_remote_command(window, "seek", Some(seconds));
        }
        MediaControlEvent::SeekBy(direction, duration) => {
            let seconds = seek_relative(position_seconds, direction, duration.as_secs_f64());
            emit_remote_command(window, "seek", Some(seconds));
        }
        MediaControlEvent::Seek(direction) => {
            let seconds = seek_relative(position_seconds, direction, SEEK_STEP_SECONDS);
            emit_remote_command(window, "seek", Some(seconds));
        }
        MediaControlEvent::Raise => {
            let _ = window.set_focus();
        }
        MediaControlEvent::Quit => emit_remote_command(window, "stop", None),
        MediaControlEvent::OpenUri(_) | MediaControlEvent::SetVolume(_) => {}
    }
}

fn emit_remote_command(window: &WebviewWindow, command: &'static str, position: Option<f64>) {
    let _ = window.emit(
        REMOTE_COMMAND_EVENT,
        MediaRemoteCommandPayload { command, position },
    );
}

fn media_playback_from_payload(payload: &MediaSessionPayload) -> MediaPlayback {
    let progress = payload
        .position
        .and_then(valid_seconds)
        .map(|seconds| MediaPosition(Duration::from_secs_f64(seconds)));

    match payload.playback_state {
        MediaPlaybackState::None => MediaPlayback::Stopped,
        MediaPlaybackState::Playing => MediaPlayback::Playing { progress },
        MediaPlaybackState::Paused => MediaPlayback::Paused { progress },
    }
}

fn seek_relative(
    position_seconds: &Arc<Mutex<f64>>,
    direction: SeekDirection,
    offset_seconds: f64,
) -> f64 {
    let Ok(mut position) = position_seconds.lock() else {
        return 0.0;
    };

    match direction {
        SeekDirection::Forward => {
            *position += offset_seconds;
        }
        SeekDirection::Backward => {
            *position = (*position - offset_seconds).max(0.0);
        }
    }

    *position
}

fn set_position(position_seconds: &Arc<Mutex<f64>>, position: f64) -> Result<(), String> {
    let mut current = position_seconds
        .lock()
        .map_err(|_| "media position lock poisoned".to_string())?;
    *current = position;
    Ok(())
}

fn valid_seconds(value: f64) -> Option<f64> {
    if value.is_finite() && value >= 0.0 {
        Some(value)
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn platform_hwnd(window: &WebviewWindow) -> Result<Option<*mut c_void>, String> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};

    let handle = window.window_handle().map_err(|error| error.to_string())?;
    match handle.as_raw() {
        RawWindowHandle::Win32(handle) => Ok(Some(handle.hwnd.get() as *mut c_void)),
        _ => Err("Windows media controls require a Win32 window handle".to_string()),
    }
}

#[cfg(not(target_os = "windows"))]
fn platform_hwnd(_window: &WebviewWindow) -> Result<Option<*mut c_void>, String> {
    Ok(None)
}
