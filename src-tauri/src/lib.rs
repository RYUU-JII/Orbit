use std::collections::HashSet;
use std::fs;
use std::process::Command;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
struct Project {
    name: String,
    path: String,
    last_modified: Option<u64>,
    last_modified_file: Option<String>, // 최근 수정된 파일명
    project_type: String,               // 프로젝트 성격 (web, app, game, server...)
    techs: Vec<String>,
    ides: Vec<String>,
}

#[tauri::command]
fn get_projects(base_path: String) -> Vec<Project> {
    let mut projects = Vec::new();
    if let Ok(entries) = fs::read_dir(base_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 기본 수정 시각
                let last_modified = entry
                    .metadata()
                    .ok()
                    .and_then(|metadata| metadata.modified().ok())
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as u64);

                // 상세 분석
                let (techs, ides) = detect_project_signals(&path);
                let project_type = detect_project_type(&path, &techs);
                let last_modified_file = find_latest_file(&path);

                projects.push(Project {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    path: path.to_string_lossy().into_owned(),
                    last_modified,
                    last_modified_file,
                    project_type,
                    techs,
                    ides,
                });
            }
        }
    }
    projects
}

// --- 신규 로직: 프로젝트 타입 판별 ---
fn detect_project_type(path: &Path, techs: &Vec<String>) -> String {
    let (files, dirs) = collect_dir_entries(path);
    let techs_set: HashSet<_> = techs.iter().map(|s| s.as_str()).collect();

    // 1. Chrome Extension (최우선)
    if files.contains("manifest.json") && (techs_set.contains("javascript") || techs_set.contains("typescript")) {
        // package.json이 없거나, 있어도 name/description에 extension 힌트가 있을 수 있음
        // 여기선 단순하게 manifest.json 존재 여부로 판단
        return "extension".to_string();
    }

    // 2. Desktop App
    if techs_set.contains("tauri") || techs_set.contains("electron") || techs_set.contains("flutter") {
        return "desktop".to_string();
    }
    if has_suffix(&files, ".sln") && (has_suffix(&files, ".csproj") || dirs.contains("WpfApp") || dirs.contains("WinForms")) {
        return "desktop".to_string();
    }

    // 3. Mobile App
    if techs_set.contains("react-native") || techs_set.contains("expo") || techs_set.contains("flutter") || dirs.contains("ios") && dirs.contains("android") {
        return "mobile".to_string();
    }

    // 4. Game
    if techs_set.contains("unity") || has_suffix(&files, ".unitypackage") || dirs.contains("Assets") {
        return "game".to_string();
    }
    if techs_set.contains("unreal") || has_suffix(&files, ".uproject") {
        return "game".to_string();
    }

    // 5. Backend / Server
    if techs_set.contains("go") || techs_set.contains("rust") || techs_set.contains("java") || techs_set.contains("php") || files.contains("docker-compose.yml") {
        // 웹 프론트 힌트가 아예 없으면 서버로 간주
        if !techs_set.contains("react") && !techs_set.contains("vue") && !techs_set.contains("nextjs") {
            return "server".to_string();
        }
    }

    // 6. Web Frontend (기본값)
    if techs_set.contains("react") || techs_set.contains("vue") || techs_set.contains("svelte") || techs_set.contains("nextjs") || techs_set.contains("astro") || files.contains("index.html") {
        return "web".to_string();
    }

    // 7. Library / Tool
    if files.contains("package.json") && !files.contains("index.html") {
        return "library".to_string();
    }

    "unknown".to_string()
}

// --- 신규 로직: 최근 수정된 파일 찾기 (재귀, 성능 최적화) ---
fn find_latest_file(root: &Path) -> Option<String> {
    let mut latest_time = SystemTime::UNIX_EPOCH;
    let mut latest_file = None;
    let ignore_dirs = HashSet::from([
        "node_modules", ".git", "target", "dist", "build", ".next", ".idea", ".vscode", "coverage", "bin", "obj", "lib"
    ]);

    visit_dirs(root, root, &ignore_dirs, &mut latest_time, &mut latest_file);
    latest_file
}

fn visit_dirs(
    dir: &Path, 
    root: &Path,
    ignore: &HashSet<&str>, 
    latest_time: &mut SystemTime, 
    latest_file: &mut Option<String>
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if path.is_dir() {
                if !ignore.contains(file_name.as_str()) && !file_name.starts_with('.') {
                    visit_dirs(&path, root, ignore, latest_time, latest_file);
                }
            } else {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified > *latest_time {
                            *latest_time = modified;
                            // 루트 기준 상대 경로 생성
                            if let Ok(rel) = path.strip_prefix(root) {
                                *latest_file = Some(rel.to_string_lossy().into_owned());
                            } else {
                                *latest_file = Some(file_name);
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- 기존 로직 유지 ---

fn detect_project_signals(path: &Path) -> (Vec<String>, Vec<String>) {
    let (files, dirs) = collect_dir_entries(path);
    let mut techs = HashSet::new();
    let mut ides = HashSet::new();

    if dirs.contains(".vscode") || has_suffix(&files, ".code-workspace") { add_id(&mut ides, "vscode"); }
    if dirs.contains(".idea") { add_id(&mut ides, "jetbrains"); }
    if dirs.contains(".vs") || has_suffix(&files, ".sln") { add_id(&mut ides, "visualstudio"); }
    if has_suffix(&dirs, ".xcodeproj") || has_suffix(&dirs, ".xcworkspace") { add_id(&mut ides, "xcode"); }

    if files.contains("package.json") {
        add_id(&mut techs, "node");
        detect_js_stack(path, &mut techs);
    }
    // ... (기존 techs 감지 로직 모두 동일하게 유지) ...
    if has_prefix(&files, "vite.config.") { add_id(&mut techs, "vite"); }
    if has_prefix(&files, "next.config.") { add_id(&mut techs, "nextjs"); }
    if has_prefix(&files, "nuxt.config.") { add_id(&mut techs, "nuxt"); }
    if has_prefix(&files, "svelte.config.") { add_id(&mut techs, "svelte"); }
    if has_prefix(&files, "astro.config.") { add_id(&mut techs, "astro"); }
    if files.contains("angular.json") { add_id(&mut techs, "angular"); }
    if files.contains("tsconfig.json") || has_prefix_suffix(&files, "tsconfig.", ".json") { add_id(&mut techs, "typescript"); }
    if files.contains("jsconfig.json") { add_id(&mut techs, "javascript"); }
    if files.contains("deno.json") || files.contains("deno.jsonc") { add_id(&mut techs, "deno"); }
    if files.contains("bun.lockb") { add_id(&mut techs, "bun"); }
    if files.contains("cargo.toml") { add_id(&mut techs, "rust"); }
    if dirs.contains("src-tauri") || files.contains("tauri.conf.json") {
        add_id(&mut techs, "tauri");
        add_id(&mut techs, "rust");
    }
    if files.contains("go.mod") { add_id(&mut techs, "go"); }
    if files.contains("pyproject.toml") || files.contains("requirements.txt") || files.contains("pipfile") || files.contains("setup.py") || files.contains("setup.cfg") { add_id(&mut techs, "python"); }
    if files.contains("pom.xml") { add_id(&mut techs, "java"); }
    if files.contains("build.gradle") || files.contains("settings.gradle") { add_id(&mut techs, "java"); }
    if files.contains("build.gradle.kts") || files.contains("settings.gradle.kts") { add_id(&mut techs, "java"); add_id(&mut techs, "kotlin"); }
    if has_suffix(&files, ".csproj") || has_suffix(&files, ".fsproj") || has_suffix(&files, ".vbproj") || has_suffix(&files, ".sln") { add_id(&mut techs, "dotnet"); }
    if files.contains("gemfile") { add_id(&mut techs, "ruby"); }
    if files.contains("composer.json") { add_id(&mut techs, "php"); }
    if files.contains("mix.exs") { add_id(&mut techs, "elixir"); }
    if files.contains("pubspec.yaml") { add_id(&mut techs, "dart"); detect_flutter(path, &mut techs); }
    if files.contains("cmakelists.txt") { add_id(&mut techs, "cpp"); }
    if has_suffix(&files, ".cpp") || has_suffix(&files, ".cxx") || has_suffix(&files, ".cc") || has_suffix(&files, ".hpp") { add_id(&mut techs, "cpp"); }
    if has_suffix(&files, ".c") || has_suffix(&files, ".h") { add_id(&mut techs, "c"); }
    if files.contains("package.json") && !techs.contains("typescript") { add_id(&mut techs, "javascript"); }

    (sorted_vec(techs), sorted_vec(ides))
}

fn detect_js_stack(path: &Path, techs: &mut HashSet<String>) {
    let package_path = path.join("package.json");
    let contents = match fs::read_to_string(package_path) { Ok(c) => c, Err(_) => return, };
    let json: Value = match serde_json::from_str(&contents) { Ok(j) => j, Err(_) => return, };
    let deps = json.get("dependencies").and_then(|v| v.as_object());
    let dev_deps = json.get("devDependencies").and_then(|v| v.as_object());
    let has_dep = |name: &str| { deps.map_or(false, |d| d.contains_key(name)) || dev_deps.map_or(false, |d| d.contains_key(name)) };

    if has_dep("typescript") { add_id(techs, "typescript"); }
    if has_dep("react") || has_dep("react-dom") { add_id(techs, "react"); }
    if has_dep("next") { add_id(techs, "nextjs"); }
    if has_dep("vue") { add_id(techs, "vue"); }
    if has_dep("nuxt") || has_dep("nuxt3") { add_id(techs, "nuxt"); }
    if has_dep("svelte") || has_dep("@sveltejs/kit") { add_id(techs, "svelte"); }
    if has_dep("@angular/core") { add_id(techs, "angular"); }
    if has_dep("solid-js") || has_dep("solid-start") { add_id(techs, "solid"); }
    if has_dep("vite") { add_id(techs, "vite"); }
    if has_dep("astro") { add_id(techs, "astro"); }
    if has_dep("electron") { add_id(techs, "electron"); }
    if has_dep("tauri") || has_dep("@tauri-apps/api") { add_id(techs, "tauri"); }
    if has_dep("react-native") { add_id(techs, "react-native"); }
    if has_dep("expo") { add_id(techs, "expo"); }
}

fn detect_flutter(path: &Path, techs: &mut HashSet<String>) {
    let pubspec_path = path.join("pubspec.yaml");
    if let Ok(contents) = fs::read_to_string(pubspec_path) {
        if contents.lines().any(|l| l.trim_start().starts_with("flutter:")) {
            add_id(techs, "flutter");
        }
    }
}

fn collect_dir_entries(path: &Path) -> (HashSet<String>, HashSet<String>) {
    let mut files = HashSet::new();
    let mut dirs = HashSet::new();
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if entry.path().is_dir() { dirs.insert(name); } else { files.insert(name); }
        }
    }
    (files, dirs)
}

fn add_id(set: &mut HashSet<String>, id: &str) { set.insert(id.to_string()); }
fn has_prefix(set: &HashSet<String>, prefix: &str) -> bool { set.iter().any(|n| n.starts_with(prefix)) }
fn has_suffix(set: &HashSet<String>, suffix: &str) -> bool { set.iter().any(|n| n.ends_with(suffix)) }
fn has_prefix_suffix(set: &HashSet<String>, prefix: &str, suffix: &str) -> bool { set.iter().any(|n| n.starts_with(prefix) && n.ends_with(suffix)) }
fn sorted_vec(set: HashSet<String>) -> Vec<String> { let mut i: Vec<String> = set.into_iter().collect(); i.sort(); i }

#[tauri::command]
fn open_project(path: String, ide_id: String, target_file: Option<String>) -> Result<(), String> {
    // target_file이 있으면 파일 경로를, 없으면 폴더 경로만 사용합니다.
    let final_path = match target_file {
        Some(file) => format!("{}/{}", path, file),
        None => path,
    };

    let executable = match ide_id.as_str() {
        "vscode" => "code",
        "cursor" => "cursor",
        "intellijidea" => "idea",
        "webstorm" => "webstorm",
        "pycharm" => "pycharm",
        "visualstudio" => "devenv",
        _ => &ide_id,
    };

    Command::new("cmd")
        .args(["/C", executable, &final_path])
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    // 윈도우 탐색기 실행. 경고 방지를 위해 결과값을 명시적으로 처리합니다.
    Command::new("explorer")
        .arg(&path)
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
        .invoke_handler(tauri::generate_handler![get_projects, open_project, open_in_explorer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}