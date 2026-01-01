#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // lib.rs에 있는 run 함수를 실행합니다.
    orbit_lib::run(); 
}