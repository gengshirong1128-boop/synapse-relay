#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

fn ensure_backend() {
    let status = Command::new("python")
        .args(["-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)"])
        .status();

    if status.is_ok() && status.unwrap().success() {
        return;
    }

    let _ = Command::new("python")
        .args(["launch.py", "--no-browser"])
        .spawn();
}

fn main() {
    ensure_backend();
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
