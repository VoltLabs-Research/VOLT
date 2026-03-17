#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn configure_linux_runtime_env() {
    std::env::remove_var("GIO_EXTRA_MODULES");
    std::env::remove_var("GTK_PATH");
    std::env::set_var("GIO_MODULE_DIR", "/nonexistent");
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_linux_runtime_env();

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
