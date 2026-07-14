use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use tauri::{Emitter, Manager, State};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
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
    pub language: String,        // "id" or "en"
    pub sound_enabled: bool,
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
        language: "id".to_string(),
        sound_enabled: true,
    }
}

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> AppStateData {
    state.data.lock().unwrap().clone()
}

#[tauri::command]
fn toggle_reminder(id: String, enabled: bool, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.is_enabled = enabled;
        if enabled {
            reminder.next_trigger = Some(get_current_time() + (reminder.interval_minutes as u64 * 60));
        } else {
            reminder.next_trigger = None;
        }
    }
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn log_reminder_progress(id: String, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.progress_count = reminder.progress_count.saturating_add(1);
        if reminder.is_enabled {
            reminder.next_trigger = Some(get_current_time() + (reminder.interval_minutes as u64 * 60));
        }
    }
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn update_reminder_settings(
    id: String,
    label: String,
    message: String,
    interval_minutes: u32,
    target: u32,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == id) {
        reminder.label = label;
        reminder.message = message;
        reminder.interval_minutes = interval_minutes;
        reminder.progress_target = target;
        if reminder.is_enabled {
            reminder.next_trigger = Some(get_current_time() + (interval_minutes as u64 * 60));
        }
    }
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn control_pomodoro(action: String, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
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
    
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn update_pomodoro_settings(focus: u32, short: u32, long: u32, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
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
    
    update_tray_menu(&app_handle, &data);
    data.clone()
}

fn get_reminder_translations(id: &str, lang: &str) -> (String, String) {
    match lang {
        "en" => match id {
            "water" => (
                "Drink Water".to_string(),
                "Time to drink a glass of water to stay hydrated!".to_string(),
            ),
            "stretch" => (
                "Stretching".to_string(),
                "Get up, walk around, and do some light stretching!".to_string(),
            ),
            "eye" => (
                "Eye Rest (20-20-20)".to_string(),
                "Focus your eyes on an object 20 feet (6 meters) away for 20 seconds.".to_string(),
            ),
            "posture" => (
                "Check Posture".to_string(),
                "Adjust your sitting position. Straighten your back and relax your shoulders!".to_string(),
            ),
            _ => (id.to_string(), "".to_string()),
        },
        _ => match id {
            "water" => (
                "Minum Air".to_string(),
                "Saatnya minum segelas air untuk tetap terhidrasi!".to_string(),
            ),
            "stretch" => (
                "Peregangan".to_string(),
                "Ayo berdiri, berjalan sedikit, dan lakukan peregangan ringan!".to_string(),
            ),
            "eye" => (
                "Istirahat Mata (20-20-20)".to_string(),
                "Fokuskan mata Anda ke obyek berjarak 20 kaki (6 meter) selama 20 detik.".to_string(),
            ),
            "posture" => (
                "Periksa Postur".to_string(),
                "Perbaiki posisi duduk Anda. Tegakkan punggung dan rilekskan bahu!".to_string(),
            ),
            _ => (id.to_string(), "".to_string()),
        },
    }
}

fn update_tray_menu(app_handle: &tauri::AppHandle, data: &AppStateData) {
    let lang = &data.language;
    let show_label = if lang == "en" { "Open Application" } else { "Buka Aplikasi" };
    let quit_label = if lang == "en" { "Quit Kerja Sehat" } else { "Keluar Kerja Sehat" };

    let menu = match Menu::new(app_handle) {
        Ok(m) => m,
        Err(_) => return,
    };

    if let Ok(show_item) = MenuItem::with_id(app_handle, "show", show_label, true, None::<&str>) {
        let _ = menu.append(&show_item);
    }

    // Add current time item
    let local_time = Local::now().format("%H:%M:%S").to_string();
    let time_label = if lang == "en" {
        format!("🕒 Time: {}", local_time)
    } else {
        format!("🕒 Waktu: {}", local_time)
    };
    if let Ok(time_item) = MenuItem::with_id(app_handle, "current_time", &time_label, false, None::<&str>) {
        let _ = menu.append(&time_item);
    }

    if let Ok(sep) = PredefinedMenuItem::separator(app_handle) {
        let _ = menu.append(&sep);
    }

    // Header progress
    let count_header_label = if lang == "en" { "Today's Progress:" } else { "Progress Hari Ini:" };
    if let Ok(header) = MenuItem::with_id(app_handle, "header_count", count_header_label, false, None::<&str>) {
        let _ = menu.append(&header);
    }

    // Pomodoro timer status (Live Countdown)
    let minutes = data.pomodoro.time_left / 60;
    let seconds = data.pomodoro.time_left % 60;
    let time_str = format!("{:02}:{:02}", minutes, seconds);

    let mode_str = match data.pomodoro.mode {
        PomodoroMode::Focus => if lang == "en" { "Focus" } else { "Fokus" },
        PomodoroMode::ShortBreak => if lang == "en" { "Short Break" } else { "Istirahat Pendek" },
        PomodoroMode::LongBreak => if lang == "en" { "Long Break" } else { "Istirahat Panjang" },
    };

    let state_suffix = match data.pomodoro.state {
        PomodoroState::Running => "".to_string(),
        PomodoroState::Paused => if lang == "en" { " (Paused)" } else { " (Jeda)" }.to_string(),
        PomodoroState::Idle => if lang == "en" { " (Ready)" } else { " (Siap)" }.to_string(),
    };

    let pom_timer_label = format!("⏱️ {}: {}{}", mode_str, time_str, state_suffix);
    if let Ok(pom_timer_item) = MenuItem::with_id(app_handle, "pom_timer", &pom_timer_label, false, None::<&str>) {
        let _ = menu.append(&pom_timer_item);
    }

    // Pomodoro sessions completed
    let pom_sessions_label = if lang == "en" {
        format!("🎯 Sessions Completed: {}", data.pomodoro.sessions_completed)
    } else {
        format!("🎯 Sesi Selesai: {}", data.pomodoro.sessions_completed)
    };
    if let Ok(pom_sessions_item) = MenuItem::with_id(app_handle, "pom_sessions", &pom_sessions_label, false, None::<&str>) {
        let _ = menu.append(&pom_sessions_item);
    }

    // Reminders
    for r in &data.reminders {
        if r.is_enabled {
            let emoji = match r.id.as_str() {
                "water" => "💧",
                "stretch" => "🏃",
                "eye" => "👁️",
                "posture" => "🪑",
                _ => "✨",
            };
            
            // Calculate remaining time
            let now = get_current_time();
            let time_suffix = if let Some(next) = r.next_trigger {
                if next > now {
                    let diff_secs = next - now;
                    let mins = diff_secs / 60;
                    if mins > 0 {
                        format!(" ({}m)", mins)
                    } else {
                        if lang == "en" { " (<1m)".to_string() } else { " (<1m)".to_string() }
                    }
                } else {
                    if lang == "en" { " (now)".to_string() } else { " (sekarang)".to_string() }
                }
            } else {
                "".to_string()
            };

            let rem_label = format!("{} {}: {}/{}{}", emoji, r.label, r.progress_count, r.progress_target, time_suffix);
            let menu_id = format!("log_{}", r.id);
            if let Ok(rem_item) = MenuItem::with_id(app_handle, &menu_id, &rem_label, true, None::<&str>) {
                let _ = menu.append(&rem_item);
            }
        }
    }

    if let Ok(sep) = PredefinedMenuItem::separator(app_handle) {
        let _ = menu.append(&sep);
    }

    if let Ok(quit_item) = MenuItem::with_id(app_handle, "quit", quit_label, true, None::<&str>) {
        let _ = menu.append(&quit_item);
    }

    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        let _ = tray.set_menu(Some(menu));
        
        let tooltip = if lang == "en" {
            format!("Kerja Sehat\n{}: {}{}\nSessions Completed: {}", mode_str, time_str, state_suffix, data.pomodoro.sessions_completed)
        } else {
            format!("Kerja Sehat\n{}: {}{}\nSesi Selesai: {}", mode_str, time_str, state_suffix, data.pomodoro.sessions_completed)
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

#[tauri::command]
fn set_language(lang: String, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    data.language = lang.clone();
    
    // Update reminder labels & messages
    for reminder in data.reminders.iter_mut() {
        let (label, message) = get_reminder_translations(&reminder.id, &lang);
        reminder.label = label;
        reminder.message = message;
    }
    
    // Update tray menu
    update_tray_menu(&app_handle, &data);
    
    data.clone()
}

#[tauri::command]
fn add_custom_reminder(
    label: String,
    interval_minutes: u32,
    target: u32,
    message: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    let now = get_current_time();
    let id = format!("custom_{}", now); // Generate a unique ID
    let new_reminder = Reminder {
        id,
        label,
        interval_minutes,
        next_trigger: Some(now + interval_minutes as u64 * 60),
        is_enabled: true,
        progress_count: 0,
        progress_target: target,
        message,
    };
    data.reminders.push(new_reminder);
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn delete_reminder(id: String, app_handle: tauri::AppHandle, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    data.reminders.retain(|r| r.id != id);
    update_tray_menu(&app_handle, &data);
    data.clone()
}

#[tauri::command]
fn toggle_sound(enabled: bool, state: State<'_, AppState>) -> AppStateData {
    let mut data = state.data.lock().unwrap();
    data.sound_enabled = enabled;
    data.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            // Setup System Tray Menu with initial state
            let initial_state = get_initial_state();

            // Safely set up Tray Icon
            let icon = app.default_window_icon().cloned();
            let mut tray_builder = TrayIconBuilder::with_id("main_tray");
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
                        id if id.starts_with("log_") => {
                            let reminder_id = &id[4..];
                            let state = app.state::<AppState>();
                            let mut data = state.data.lock().unwrap();
                            let now = get_current_time();
                            if let Some(reminder) = data.reminders.iter_mut().find(|r| r.id == reminder_id) {
                                reminder.progress_count = std::cmp::min(reminder.progress_target, reminder.progress_count + 1);
                                if reminder.is_enabled {
                                    reminder.next_trigger = Some(now + (reminder.interval_minutes as u64 * 60));
                                }
                            }
                            let updated_data = data.clone();
                            drop(data); // Drop lock before updating tray menu and emitting
                            
                            update_tray_menu(app, &updated_data);
                            let _ = app.emit("state-tick", &updated_data);
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

            // Initialize tray menu items and tooltips
            update_tray_menu(app.handle(), &initial_state);

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
                    let current_lang;

                    {
                        let state = app_handle.state::<AppState>();
                        let mut data = state.data.lock().unwrap();
                        let now = get_current_time();
                        let today = get_current_date_string();
                        current_lang = data.language.clone();

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
                                        triggered_reminders.push((reminder.id.clone(), reminder.label.clone(), reminder.message.clone()));
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
                                                next_pomodoro_mode = Some(if current_lang == "en" {
                                                    "Time for a Long Break!"
                                                } else {
                                                    "Saatnya Istirahat Panjang (Long Break)!"
                                                }.to_string());
                                            } else {
                                                pom.mode = PomodoroMode::ShortBreak;
                                                pom.current_duration = pom.short_break_duration * 60;
                                                next_pomodoro_mode = Some(if current_lang == "en" {
                                                    "Time for a Short Break!"
                                                } else {
                                                    "Saatnya Istirahat Sejenak (Short Break)!"
                                                }.to_string());
                                            }
                                        }
                                        PomodoroMode::ShortBreak | PomodoroMode::LongBreak => {
                                            pom.mode = PomodoroMode::Focus;
                                            pom.current_duration = pom.focus_duration * 60;
                                            next_pomodoro_mode = Some(if current_lang == "en" {
                                                "Time to Focus Again!"
                                            } else {
                                                "Saatnya Fokus Kembali!"
                                            }.to_string());
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

                        // Always update tray menu to keep current clock time and reminder countdowns fresh!
                        update_tray_menu(&app_handle, &data);
                    }

                    // Emit state update event
                    if let Some(ref data_clone) = current_state_clone {
                        let _ = app_handle.emit("state-tick", data_clone);
                    }

                    // Handle notifications
                    use tauri_plugin_notification::NotificationExt;
                    for (id, label, message) in triggered_reminders {
                        let _ = app_handle.emit("reminder-triggered", &id);
                        let _ = app_handle.notification()
                            .builder()
                            .title(&label)
                            .body(&message)
                            .show();
                    }

                    if pomodoro_triggered {
                        let title = if current_lang == "en" { "Pomodoro Finished!" } else { "Pomodoro Selesai!" };
                        let body = next_pomodoro_mode.clone().unwrap_or(if current_lang == "en" { "Your session has finished." } else { "Sesi Anda telah selesai." }.to_string());
                        let _ = app_handle.emit("pomodoro-triggered", &body);
                        let _ = app_handle.notification()
                            .builder()
                            .title(title)
                            .body(&body)
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
            update_pomodoro_settings,
            set_language,
            add_custom_reminder,
            delete_reminder,
            toggle_sound
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
