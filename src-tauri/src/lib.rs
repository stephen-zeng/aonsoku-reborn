#[cfg(target_os = "macos")]
mod macos;
mod media;

pub fn run() {
    tauri::Builder::default()
        .manage(media::MediaControlsState::default())
        .invoke_handler(tauri::generate_handler![
            media::media_update_session,
            media::media_clear_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aonsoku Tauri application");
}
