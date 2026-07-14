use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use tauri::menu::{Menu, MenuItem};
use chrono::Local;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Reminder {
    pub id: String,
    pub label: String,
    pub interval_minutes: u32,
    pub next_trigger: Option<u64>, // Unix timestamp in seconds
    pub is_enabled: bool,
    pub progress_count: u32,
    pub progress_target: u32,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum PomodoroMode {
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum PomodoroState {
    Idle,
    Running,
    Paused,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Pomodoro {
    pub mode: PomodoroMode,
    pub state: PomodoroState,
    pub focus_duration: u32,       // in minutes
    pub short_break_duration: u32,  // in minutes
    pub long_break_duration: u32,   // in minutes
    pub current_duration: u32,      // in seconds for current mode
    pub time_left: u32,             // in seconds remaining
    pub target_timestamp: Option<u64>,
    pub sessions_completed: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppStateData {
    pub reminders: Vec<Reminder>,
    pub pomodoro: Pomodoro,
    pub last_reset_date: String, // YYYY-MM-DD
}

pub struct AppState {
    pub data: Mutex<AppStateData>,
}

fn get_current_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn get_current_date_string() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn get_initial_state() -> AppStateData {
    let now = get_current_time();
    AppStateData {
        reminders: vec![
            Reminder {
                id: "water".to_string(),
                label: "Minum Air".to_string(),
                interval_minutes: 60,
                next_trigger: Some(now + 60 * 60),
                is_enabled: true,
                progress_count: 0,
                progress_target: 8,
                message: "Saatnya minum segelas air untuk tetap terhidrasi!".to_string(),
            },
            Reminder {
                id: "stretch".to_string(),
                label: "Peregangan".to_string(),
                interval_minutes: 120,
                next_trigger: Some(now + 120 * 60),
                is_enabled: true,
                progress_count: 0,
                progress_target: 4,
                message: "Ayo berdiri, berjalan sedikit, dan lakukan peregangan ringan!".to_string(),
            },
            Reminder {
                id: "eye".to_string(),
                label: "Istirahat Mata (20-20-20)".to_string(),
                interval_minutes: 20,
                next_trigger: Some(now + 20 * 60),
                is_enabled: true,
                progress_count: 0,
                progress_target: 24,
                message: "Fokuskan mata Anda ke obyek berjarak 20 kaki (6 meter) selama 20 detik.".to_string(),
            },
            Reminder {
                id: "posture".to_string(),
                label: "Periksa Postur".to_string(),
                interval_minutes: 30,
                next_trigger: Some(now + 30 * 60),
                is_enabled: true,
                progress_count: 0,
                progress_target: 16,
                message: "Perbaiki posisi duduk Anda. Tegakkan punggung dan rilekskan bahu!".to_string(),
            },
        ],
        pomodoro: Pomodoro {
            mode: PomodoroMode::Focus,
            state: PomodoroState::Idle,
            focus_duration: 25,
            short_break_duration: 5,
            long_break_duration: 15,
            current_duration: 25 * 60,
            time_left: 25 * 60,
            target_timestamp: None,
            sessions_completed: 0,
        },
        last_reset_date: get_current_date_string(),
    }
}

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> AppStateData {
    state.data.lock().unwrap().clone()
}

#[tauri::command]
fn toggle_reminder(id: String, enabled: bool, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.is_enabled = enabled;
        if enabled {
            reminder.next_trigger = Some(get_current_time() + (reminder.interval_minutes as u64 * 60));
        } else {
            reminder.next_trigger = None;
        }
    }
    data.clone()
}

#[tauri::command]
fn log_reminder_progress(id: String, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.progress_count = reminder.progress_count.saturating_add(1);
        if reminder.is_enabled {
            reminder.next_trigger = Some(get_current_time() + (reminder.interval_minutes as u64 * 60));
        }
    }
    data.clone()
}

#[tauri::command]
fn update_reminder_settings(id: String, interval_minutes: u32, target: u32, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.interval_minutes = interval_minutes;
        reminder.progress_target = target;
        if reminder.is_enabled {
            reminder.next_trigger = Some(get_current_time() + (interval_minutes as u64 * 60));
        }
    }
    data.clone()
}

#[tauri::command]
fn control_pomodoro(action: String, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    let pom = &mut data.pomodoro;
    let now = get_current_time();
    
    match action.as_str() {
        "start" => {
            if pom.state != PomodoroState::Running {
                pom.state = PomodoroState::Running;
                pom.target_timestamp = Some(now + pom.time_left as u64);
            }
        }
        "pause" => {
            if pom.state == PomodoroState::Running {
                pom.state = PomodoroState::Paused;
                if let Some(target) = pom.target_timestamp {
                    pom.time_left = target.saturating_sub(now) as u32;
                }
                pom.target_timestamp = None;
            }
        }
        "reset" => {
            pom.state = PomodoroState::Idle;
            pom.time_left = pom.current_duration;
            pom.target_timestamp = None;
        }
        "skip" => {
            match pom.mode {
                PomodoroMode::Focus => {
                    pom.sessions_completed += 1;
                    if pom.sessions_completed % 4 == 0 {
                        pom.mode = PomodoroMode::LongBreak;
                        pom.current_duration = pom.long_break_duration * 60;
                    } else {
                        pom.mode = PomodoroMode::ShortBreak;
                        pom.current_duration = pom.short_break_duration * 60;
                    }
                }
                PomodoroMode::ShortBreak | PomodoroMode::LongBreak => {
                    pom.mode = PomodoroMode::Focus;
                    pom.current_duration = pom.focus_duration * 60;
                }
            }
            pom.state = PomodoroState::Idle;
            pom.time_left = pom.current_duration;
            pom.target_timestamp = None;
        }
        _ => {}
    }
    
    data.clone()
}

#[tauri::command]
fn update_pomodoro_settings(focus: u32, short: u32, long: u32, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    let pom = &mut data.pomodoro;
    
    pom.focus_duration = focus;
    pom.short_break_duration = short;
    pom.long_break_duration = long;
    
    if pom.state == PomodoroState::Idle || pom.state == PomodoroState::Paused {
        pom.current_duration = match pom.mode {
            PomodoroMode::Focus => focus * 60,
            PomodoroMode::ShortBreak => short * 60,
            PomodoroMode::LongBreak => long * 60,
        };
        pom.time_left = pom.current_duration;
        pom.target_timestamp = None;
        if pom.state == PomodoroState::Paused {
            pom.state = PomodoroState::Idle; // Reset to idle since duration changed
        }
    }
    
    data.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            data: Mutex::new(get_initial_state()),
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .setup(|app| {
            // Setup System Tray Menu
            let quit_item = MenuItem::with_id(app, "quit", "Keluar Kerja Sehat", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Buka Aplikasi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Safely set up Tray Icon
            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = icon {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Spawn background timer task
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;

                    let mut triggered_reminders = Vec::new();
                    let mut pomodoro_triggered = false;
                    let mut next_pomodoro_mode = None;
                    let mut state_changed = false;
                    let mut current_state_clone = None;

                    {
                        let state = app_handle.state::<AppState>();
                        let mut data = state.data.lock().unwrap();
                        let now = get_current_time();
                        let today = get_current_date_string();

                        // 1. Midnight Reset Check
                        if data.last_reset_date != today {
                            for r in data.reminders.iter_mut() {
                                r.progress_count = 0;
                            }
                            data.last_reset_date = today;
                            state_changed = true;
                        }

                        // 2. Check reminders
                        for reminder in data.reminders.iter_mut() {
                            if reminder.is_enabled {
                                if let Some(trigger_time) = reminder.next_trigger {
                                    if now >= trigger_time {
                                        triggered_reminders.push((reminder.label.clone(), reminder.message.clone()));
                                        reminder.next_trigger = Some(now + (reminder.interval_minutes as u64 * 60));
                                        state_changed = true;
                                    }
                                } else {
                                    reminder.next_trigger = Some(now + (reminder.interval_minutes as u64 * 60));
                                    state_changed = true;
                                }
                            }
                        }

                        // 3. Check Pomodoro
                        let pom = &mut data.pomodoro;
                        if pom.state == PomodoroState::Running {
                            state_changed = true;
                            if let Some(target) = pom.target_timestamp {
                                if now >= target {
                                    pomodoro_triggered = true;

                                    match pom.mode {
                                        PomodoroMode::Focus => {
                                            pom.sessions_completed += 1;
                                            if pom.sessions_completed % 4 == 0 {
                                                pom.mode = PomodoroMode::LongBreak;
                                                pom.current_duration = pom.long_break_duration * 60;
                                                next_pomodoro_mode = Some("Saatnya Istirahat Panjang (Long Break)!");
                                            } else {
                                                pom.mode = PomodoroMode::ShortBreak;
                                                pom.current_duration = pom.short_break_duration * 60;
                                                next_pomodoro_mode = Some("Saatnya Istirahat Sejenak (Short Break)!");
                                            }
                                        }
                                        PomodoroMode::ShortBreak | PomodoroMode::LongBreak => {
                                            pom.mode = PomodoroMode::Focus;
                                            pom.current_duration = pom.focus_duration * 60;
                                            next_pomodoro_mode = Some("Saatnya Fokus Kembali!");
                                        }
                                    }
                                    pom.time_left = pom.current_duration;
                                    pom.state = PomodoroState::Idle;
                                    pom.target_timestamp = None;
                                } else {
                                    pom.time_left = (target - now) as u32;
                                }
                            }
                        }

                        if state_changed {
                            current_state_clone = Some(data.clone());
                        }
                    }

                    // Emit state update event
                    if let Some(ref data_clone) = current_state_clone {
                        let _ = app_handle.emit("state-tick", data_clone);
                    }

                    // Handle notifications
                    use tauri_plugin_notification::NotificationExt;
                    for (label, message) in triggered_reminders {
                        let _ = app_handle.notification()
                            .builder()
                            .title(&label)
                            .body(&message)
                            .show();
                    }

                    if pomodoro_triggered {
                        let title = "Pomodoro Selesai!";
                        let body = next_pomodoro_mode.unwrap_or("Sesi Anda telah selesai.");
                        let _ = app_handle.notification()
                            .builder()
                            .title(title)
                            .body(body)
                            .show();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            toggle_reminder,
            log_reminder_progress,
            update_reminder_settings,
            control_pomodoro,
            update_pomodoro_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
