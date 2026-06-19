use std::{
    path::PathBuf,
    sync::{mpsc, Arc, Condvar, Mutex},
    time::Duration,
};

use remu_audio::{
    decoder::Decoder,
    events::PlayerEvent,
    loader::downloader::Downloader,
    player::{PlaybackControl, Player},
    reader::{MVecBytesReader, MVecBytesWrapper},
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, WebviewWindow};
use tokio::{runtime::Runtime, sync::oneshot};
use tokio_util::sync::CancellationToken;

const DESKTOP_AUDIO_EVENT: &str = "desktop-audio-event";
const PROGRESS_INTERVAL_MS: u64 = 500;
const STREAM_CHUNK_SIZE: usize = 256 * 1024;

type AudioCommandSender = mpsc::Sender<AudioCommand>;
type AudioCommandResponse = oneshot::Sender<Result<(), String>>;

#[derive(Default)]
pub struct DesktopAudioState {
    command_tx: Mutex<Option<AudioCommandSender>>,
    request_id: Arc<Mutex<Option<String>>>,
}

struct DesktopAudioWorker {
    player: Option<Player>,
    stream_handle: Option<StreamLoadHandle>,
    metadata: Option<DesktopAudioMetadata>,
    loaded: bool,
    volume: f32,
    repeat_mode: DesktopAudioRepeatMode,
    shuffle: bool,
}

struct StreamLoadHandle {
    loader: Downloader,
    condvar: Arc<Condvar>,
    cancellation_token: CancellationToken,
}

impl Drop for StreamLoadHandle {
    fn drop(&mut self) {
        self.cancellation_token.cancel();
        self.condvar.notify_all();
        let _ = self.loader.abort();
    }
}

impl Default for DesktopAudioWorker {
    fn default() -> Self {
        Self {
            player: None,
            stream_handle: None,
            metadata: None,
            loaded: false,
            volume: 1.0,
            repeat_mode: DesktopAudioRepeatMode::Off,
            shuffle: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum DesktopAudioSource {
    Stream {
        url: String,
    },
    Blob {},
    #[serde(rename = "native-file")]
    NativeFile {
        uri: String,
    },
    Radio {
        url: String,
    },
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioMetadata {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: Option<f64>,
    artwork_url: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopAudioRepeatMode {
    #[default]
    Off,
    One,
    All,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioLoadPayload {
    source: DesktopAudioSource,
    metadata: Option<DesktopAudioMetadata>,
    request_id: Option<String>,
    autoplay: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioMetadataPayload {
    metadata: DesktopAudioMetadata,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioSeekPayload {
    position: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioVolumePayload {
    value: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioRepeatModePayload {
    mode: DesktopAudioRepeatMode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAudioShufflePayload {
    enabled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAudioEventPayload {
    #[serde(rename = "type")]
    event_type: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    buffered_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_buffering: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    native_code: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<&'static str>,
}

enum AudioCommand {
    Load {
        source: DesktopAudioSource,
        metadata: Option<DesktopAudioMetadata>,
        request_id: Option<String>,
        autoplay: bool,
        response: AudioCommandResponse,
    },
    Play {
        response: AudioCommandResponse,
    },
    Pause {
        response: AudioCommandResponse,
    },
    Stop {
        response: AudioCommandResponse,
    },
    Seek {
        position: f64,
        response: AudioCommandResponse,
    },
    SetVolume {
        value: f64,
        response: AudioCommandResponse,
    },
    UpdateMetadata {
        metadata: DesktopAudioMetadata,
        response: AudioCommandResponse,
    },
    SetRepeatMode {
        mode: DesktopAudioRepeatMode,
        response: AudioCommandResponse,
    },
    SetShuffle {
        enabled: bool,
        response: AudioCommandResponse,
    },
}

#[tauri::command]
pub async fn desktop_audio_load(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioLoadPayload,
) -> Result<(), String> {
    state.set_request_id(payload.request_id.clone())?;
    state
        .send_command(&window, |response| AudioCommand::Load {
            source: payload.source,
            metadata: payload.metadata,
            request_id: payload.request_id,
            autoplay: payload.autoplay.unwrap_or(false),
            response,
        })
        .await
}

#[tauri::command]
pub async fn desktop_audio_play(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::Play { response })
        .await
}

#[tauri::command]
pub async fn desktop_audio_pause(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::Pause { response })
        .await
}

#[tauri::command]
pub async fn desktop_audio_stop(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::Stop { response })
        .await
}

#[tauri::command]
pub async fn desktop_audio_seek(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioSeekPayload,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::Seek {
            position: payload.position,
            response,
        })
        .await
}

#[tauri::command]
pub async fn desktop_audio_set_volume(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioVolumePayload,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::SetVolume {
            value: payload.value,
            response,
        })
        .await
}

#[tauri::command]
pub async fn desktop_audio_update_metadata(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioMetadataPayload,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::UpdateMetadata {
            metadata: payload.metadata,
            response,
        })
        .await
}

#[tauri::command]
pub async fn desktop_audio_set_repeat_mode(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioRepeatModePayload,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::SetRepeatMode {
            mode: payload.mode,
            response,
        })
        .await
}

#[tauri::command]
pub async fn desktop_audio_set_shuffle(
    window: WebviewWindow,
    state: tauri::State<'_, DesktopAudioState>,
    payload: DesktopAudioShufflePayload,
) -> Result<(), String> {
    state
        .send_command(&window, |response| AudioCommand::SetShuffle {
            enabled: payload.enabled,
            response,
        })
        .await
}

impl DesktopAudioState {
    fn set_request_id(&self, request_id: Option<String>) -> Result<(), String> {
        let mut current = self
            .request_id
            .lock()
            .map_err(|_| "desktop audio request lock poisoned".to_string())?;
        *current = request_id;
        Ok(())
    }

    async fn send_command<F>(&self, window: &WebviewWindow, command: F) -> Result<(), String>
    where
        F: FnOnce(AudioCommandResponse) -> AudioCommand,
    {
        let tx = self.ensure_worker(window)?;
        let (response_tx, response_rx) = oneshot::channel();
        let audio_command = command(response_tx);

        if tx.send(audio_command).is_err() {
            self.clear_worker()?;
            return Err("desktop audio worker unavailable".to_string());
        }

        response_rx
            .await
            .map_err(|_| "desktop audio worker dropped response".to_string())?
    }

    fn ensure_worker(&self, window: &WebviewWindow) -> Result<AudioCommandSender, String> {
        let mut command_tx = self
            .command_tx
            .lock()
            .map_err(|_| "desktop audio command lock poisoned".to_string())?;

        if let Some(tx) = command_tx.as_ref() {
            return Ok(tx.clone());
        }

        let (tx, rx) = mpsc::channel();
        let worker_window = window.clone();
        let request_id = Arc::clone(&self.request_id);
        std::thread::Builder::new()
            .name("aonsoku-desktop-audio".to_string())
            .spawn(move || run_audio_worker(worker_window, request_id, rx))
            .map_err(|error| error.to_string())?;

        *command_tx = Some(tx.clone());
        Ok(tx)
    }

    fn clear_worker(&self) -> Result<(), String> {
        let mut command_tx = self
            .command_tx
            .lock()
            .map_err(|_| "desktop audio command lock poisoned".to_string())?;
        *command_tx = None;
        Ok(())
    }
}

fn run_audio_worker(
    window: WebviewWindow,
    request_id: Arc<Mutex<Option<String>>>,
    rx: mpsc::Receiver<AudioCommand>,
) {
    let runtime = match Runtime::new() {
        Ok(runtime) => runtime,
        Err(error) => {
            emit_error(
                &window,
                &request_id,
                "runtime_unavailable",
                "unknown",
                error.to_string(),
            );
            return;
        }
    };

    let mut worker = DesktopAudioWorker::default();

    loop {
        match rx.recv_timeout(Duration::from_millis(PROGRESS_INTERVAL_MS)) {
            Ok(command) => {
                handle_audio_command(&mut worker, &runtime, &window, &request_id, command)
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                emit_worker_progress(&worker, &window, &request_id);
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn handle_audio_command(
    worker: &mut DesktopAudioWorker,
    runtime: &Runtime,
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    command: AudioCommand,
) {
    match command {
        AudioCommand::Load {
            source,
            metadata,
            request_id: next_request_id,
            autoplay,
            response,
        } => {
            let result = handle_load(
                worker,
                runtime,
                window,
                request_id,
                source,
                metadata,
                next_request_id,
                autoplay,
            );
            let _ = response.send(result);
        }
        AudioCommand::Play { response } => {
            let result = ensure_player(worker, window, request_id).map(|player| player.play());
            let _ = response.send(result.map(|_| ()));
        }
        AudioCommand::Pause { response } => {
            if let Some(player) = worker.player.as_ref() {
                player.pause();
            }
            let _ = response.send(Ok(()));
        }
        AudioCommand::Stop { response } => {
            if let Some(player) = worker.player.as_mut() {
                player.stop();
            }
            worker.loaded = false;
            worker.stream_handle = None;
            let _ = set_current_request_id(request_id, None);
            let _ = response.send(Ok(()));
        }
        AudioCommand::Seek { position, response } => {
            let result = handle_seek(worker, window, request_id, position);
            let _ = response.send(result);
        }
        AudioCommand::SetVolume { value, response } => {
            worker.volume = value.clamp(0.0, 1.0) as f32;
            if let Some(player) = worker.player.as_ref() {
                player.set_volume(worker.volume);
            }
            let _ = response.send(Ok(()));
        }
        AudioCommand::UpdateMetadata { metadata, response } => {
            worker.metadata = Some(metadata);
            let _ = response.send(Ok(()));
        }
        AudioCommand::SetRepeatMode { mode, response } => {
            worker.repeat_mode = mode;
            let _ = response.send(Ok(()));
        }
        AudioCommand::SetShuffle { enabled, response } => {
            worker.shuffle = enabled;
            let _ = response.send(Ok(()));
        }
    }
}

fn handle_load(
    worker: &mut DesktopAudioWorker,
    runtime: &Runtime,
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    source: DesktopAudioSource,
    metadata: Option<DesktopAudioMetadata>,
    next_request_id: Option<String>,
    autoplay: bool,
) -> Result<(), String> {
    set_current_request_id(request_id, next_request_id)?;
    emit_buffering(window, request_id, true);

    worker.loaded = false;
    worker.stream_handle = None;
    worker.metadata = metadata;
    let load_result = {
        let player = ensure_player(worker, window, request_id)?;
        runtime.block_on(load_source(player, &source))
    };

    let stream_handle = match load_result {
        Ok(stream_handle) => stream_handle,
        Err(error) => {
            emit_error(
                window,
                request_id,
                "load_failed",
                classify_load_error(&source, &error),
                error,
            );
            emit_buffering(window, request_id, false);
            return Err("desktop audio load failed".to_string());
        }
    };

    worker.loaded = true;
    worker.stream_handle = stream_handle;
    if let Some(player) = worker.player.as_ref() {
        player.set_volume(worker.volume);
        if autoplay {
            player.play();
        } else {
            player.pause();
        }
        let snapshot = progress_snapshot(player, worker.metadata.as_ref());
        emit_duration(window, request_id, snapshot.duration);
        emit_progress(window, request_id, snapshot);
    }
    emit_buffering(window, request_id, false);

    Ok(())
}

fn handle_seek(
    worker: &mut DesktopAudioWorker,
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    position: f64,
) -> Result<(), String> {
    let position =
        valid_seconds(position).ok_or_else(|| "invalid desktop audio seek position".to_string())?;
    let was_playing = worker
        .player
        .as_ref()
        .ok_or_else(|| "desktop audio player unavailable".to_string())?
        .paused()
        == false;

    let player = worker
        .player
        .as_ref()
        .ok_or_else(|| "desktop audio player unavailable".to_string())?;
    player
        .seek(Duration::from_secs_f64(position))
        .map_err(|error| error.to_string())?;
    if was_playing {
        player.play();
    }
    emit_progress(
        window,
        request_id,
        progress_snapshot(player, worker.metadata.as_ref()),
    );
    Ok(())
}

fn ensure_player<'a>(
    worker: &'a mut DesktopAudioWorker,
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
) -> Result<&'a mut Player, String> {
    if worker.player.is_none() {
        let player = Player::new().map_err(|error| error.to_string())?;
        install_player_callbacks(&player, window.clone(), Arc::clone(request_id));
        worker.player = Some(player);
    }

    worker
        .player
        .as_mut()
        .ok_or_else(|| "desktop audio player unavailable".to_string())
}

fn install_player_callbacks(
    player: &Player,
    window: WebviewWindow,
    request_id: Arc<Mutex<Option<String>>>,
) {
    player.set_callback(move |event| match event {
        PlayerEvent::Play => emit_simple(&window, &request_id, "play"),
        PlayerEvent::Pause => emit_simple(&window, &request_id, "pause"),
        PlayerEvent::Ended => emit_simple(&window, &request_id, "ended"),
        PlayerEvent::Waiting | PlayerEvent::LoadStart => {
            emit_buffering(&window, &request_id, true);
        }
        PlayerEvent::Playing | PlayerEvent::LoadedData | PlayerEvent::LoadedMetadata => {
            emit_buffering(&window, &request_id, false);
        }
        PlayerEvent::Error { message } => {
            emit_error(&window, &request_id, "playback_failed", "unknown", message);
        }
        PlayerEvent::DurationChange
        | PlayerEvent::VolumeChange
        | PlayerEvent::Seeking
        | PlayerEvent::Seeked
        | PlayerEvent::Emptied => {}
    });
}

async fn load_source(
    player: &mut Player,
    source: &DesktopAudioSource,
) -> Result<Option<StreamLoadHandle>, String> {
    match source {
        DesktopAudioSource::Stream { url, .. } => load_seekable_stream(player, url).await.map(Some),
        DesktopAudioSource::Radio { url, .. } => {
            player
                .load_url(url)
                .await
                .map_err(|error| error.to_string())?;
            Ok(None)
        }
        DesktopAudioSource::NativeFile { uri, .. } => {
            let path = native_file_path(uri)?;
            player
                .load_file(path.to_string_lossy().as_ref())
                .await
                .map_err(|error| error.to_string())?;
            Ok(None)
        }
        DesktopAudioSource::Blob { .. } => Err(
            "blob URLs are owned by the WebView and cannot be played by the native desktop engine"
                .to_string(),
        ),
    }
}

async fn load_seekable_stream(player: &mut Player, url: &str) -> Result<StreamLoadHandle, String> {
    let url = url_with_estimated_content_length(url);
    let wrapper = MVecBytesWrapper::new(STREAM_CHUNK_SIZE);
    let loader = Downloader::new(wrapper.clone());
    loader
        .download(&url, None)
        .await
        .map_err(|_| "failed to download desktop audio stream".to_string())?;

    let byte_len = loader.total_bytes();
    let condvar = loader.condvar();
    let reader = MVecBytesReader::new(wrapper, Arc::clone(&condvar));
    let cancellation_token = reader.cancellation_token();
    let decoder = if byte_len > 0 {
        Decoder::builder()
            .with_data(reader)
            .with_byte_len(byte_len)
            .with_seekable(true)
            .build()
            .map_err(|error| error.to_string())?
    } else {
        Decoder::builder()
            .with_data(reader)
            .with_seekable(true)
            .build()
            .map_err(|error| error.to_string())?
    };

    player
        .load_source(decoder)
        .map_err(|error| error.to_string())?;

    Ok(StreamLoadHandle {
        loader,
        condvar,
        cancellation_token,
    })
}

#[derive(Clone, Copy)]
struct ProgressSnapshot {
    current_time: f64,
    duration: f64,
    buffered_time: f64,
}

fn emit_worker_progress(
    worker: &DesktopAudioWorker,
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
) {
    let Some(player) = worker.player.as_ref() else {
        return;
    };
    if !worker.loaded {
        return;
    }

    emit_progress(
        window,
        request_id,
        progress_snapshot(player, worker.metadata.as_ref()),
    );
}

fn progress_snapshot(player: &Player, metadata: Option<&DesktopAudioMetadata>) -> ProgressSnapshot {
    let current_time = player.position().as_secs_f64();
    let player_duration = player
        .duration()
        .map(|duration| duration.as_secs_f64())
        .and_then(valid_seconds);
    let metadata_duration = metadata
        .and_then(|metadata| metadata.duration)
        .and_then(valid_seconds);
    let duration = metadata_duration.or(player_duration).unwrap_or(0.0);

    ProgressSnapshot {
        current_time,
        duration,
        buffered_time: if duration > 0.0 {
            current_time.min(duration)
        } else {
            current_time
        },
    }
}

fn url_with_estimated_content_length(url: &str) -> String {
    if let Ok(mut parsed_url) = url::Url::parse(url) {
        let query_items = parsed_url
            .query_pairs()
            .filter(|(key, _)| key != "estimateContentLength")
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect::<Vec<_>>();
        {
            let mut query_pairs = parsed_url.query_pairs_mut();
            query_pairs.clear();
            for (key, value) in query_items {
                query_pairs.append_pair(&key, &value);
            }
            query_pairs.append_pair("estimateContentLength", "true");
        }
        return parsed_url.to_string();
    }

    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}estimateContentLength=true")
}

fn emit_simple(
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    event_type: &'static str,
) {
    emit_audio_event(
        window,
        DesktopAudioEventPayload {
            event_type,
            request_id: current_request_id(request_id),
            current_time: None,
            duration: None,
            buffered_time: None,
            is_buffering: None,
            message: None,
            code: None,
            native_code: None,
            kind: None,
        },
    );
}

fn emit_progress(
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    snapshot: ProgressSnapshot,
) {
    emit_audio_event(
        window,
        DesktopAudioEventPayload {
            event_type: "progress",
            request_id: current_request_id(request_id),
            current_time: Some(snapshot.current_time),
            duration: Some(snapshot.duration),
            buffered_time: Some(snapshot.buffered_time),
            is_buffering: None,
            message: None,
            code: None,
            native_code: None,
            kind: None,
        },
    );
}

fn emit_duration(window: &WebviewWindow, request_id: &Arc<Mutex<Option<String>>>, duration: f64) {
    emit_audio_event(
        window,
        DesktopAudioEventPayload {
            event_type: "duration",
            request_id: current_request_id(request_id),
            current_time: None,
            duration: Some(duration),
            buffered_time: None,
            is_buffering: None,
            message: None,
            code: None,
            native_code: None,
            kind: None,
        },
    );
}

fn emit_buffering(
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    is_buffering: bool,
) {
    emit_audio_event(
        window,
        DesktopAudioEventPayload {
            event_type: "buffering",
            request_id: current_request_id(request_id),
            current_time: None,
            duration: None,
            buffered_time: None,
            is_buffering: Some(is_buffering),
            message: None,
            code: None,
            native_code: None,
            kind: None,
        },
    );
}

fn emit_error(
    window: &WebviewWindow,
    request_id: &Arc<Mutex<Option<String>>>,
    code: &'static str,
    kind: &'static str,
    message: String,
) {
    emit_audio_event(
        window,
        DesktopAudioEventPayload {
            event_type: "error",
            request_id: current_request_id(request_id),
            current_time: None,
            duration: None,
            buffered_time: None,
            is_buffering: None,
            message: Some(message),
            code: Some(code),
            native_code: Some(code),
            kind: Some(kind),
        },
    );
}

fn emit_audio_event(window: &WebviewWindow, payload: DesktopAudioEventPayload) {
    let _ = window.emit(DESKTOP_AUDIO_EVENT, payload);
}

fn set_current_request_id(
    request_id: &Arc<Mutex<Option<String>>>,
    next_request_id: Option<String>,
) -> Result<(), String> {
    let mut current = request_id
        .lock()
        .map_err(|_| "desktop audio request lock poisoned".to_string())?;
    *current = next_request_id;
    Ok(())
}

fn current_request_id(request_id: &Arc<Mutex<Option<String>>>) -> Option<String> {
    request_id
        .lock()
        .ok()
        .and_then(|request_id| request_id.clone())
}

fn native_file_path(uri: &str) -> Result<PathBuf, String> {
    if let Ok(url) = url::Url::parse(uri) {
        if url.scheme() == "file" {
            return url
                .to_file_path()
                .map_err(|_| format!("invalid file URI: {uri}"));
        }
    }

    Ok(PathBuf::from(uri))
}

fn valid_seconds(value: f64) -> Option<f64> {
    if value.is_finite() && value >= 0.0 {
        Some(value)
    } else {
        None
    }
}

fn classify_load_error(source: &DesktopAudioSource, message: &str) -> &'static str {
    if matches!(source, DesktopAudioSource::Blob { .. }) {
        return "source-not-supported";
    }

    let message = message.to_ascii_lowercase();
    if message.contains("download") || message.contains("network") || message.contains("request") {
        return "network";
    }
    if message.contains("unrecognized") || message.contains("unsupported") {
        return "source-not-supported";
    }

    "decode"
}
