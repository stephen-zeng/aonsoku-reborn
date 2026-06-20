mod desktop_audio;
#[cfg(target_os = "macos")]
mod macos;
mod media;

pub fn run() {
    tauri::Builder::default()
        .manage(desktop_audio::DesktopAudioState::default())
        .manage(media::MediaControlsState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_audio::desktop_audio_load,
            desktop_audio::desktop_audio_play,
            desktop_audio::desktop_audio_pause,
            desktop_audio::desktop_audio_stop,
            desktop_audio::desktop_audio_seek,
            desktop_audio::desktop_audio_set_volume,
            desktop_audio::desktop_audio_update_metadata,
            desktop_audio::desktop_audio_set_repeat_mode,
            desktop_audio::desktop_audio_set_shuffle,
            media::media_update_session,
            media::media_update_position,
            media::media_clear_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aonsoku Tauri application");
}
