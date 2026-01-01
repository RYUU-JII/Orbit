use std::fs;
use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
struct Project {
    name: String,
    path: String,
}

#[tauri::command]
fn get_projects(base_path: String) -> Vec<Project> {
    let mut projects = Vec::new();
    if let Ok(entries) = fs::read_dir(base_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                projects.push(Project {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    path: path.to_string_lossy().into_owned(),
                });
            }
        }
    }
    projects
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "code", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_projects, open_in_vscode])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}