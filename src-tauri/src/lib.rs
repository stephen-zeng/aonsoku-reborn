mod desktop_audio;
mod desktop_cache;
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
            desktop_cache::desktop_cache_store_audio_file,
            desktop_cache::desktop_cache_resolve_audio_file,
            desktop_cache::desktop_cache_get_audio_file_size,
            desktop_cache::desktop_cache_delete_audio_file,
            desktop_cache::desktop_cache_clear_audio_files,
            media::media_update_session,
            media::media_update_position,
            media::media_clear_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aonsoku Tauri application");
}
