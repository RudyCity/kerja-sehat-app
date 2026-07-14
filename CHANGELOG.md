# Changelog

All notable changes to the **Kerja Sehat** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.13] - 2026-07-14

### Added
- **System Tray Clock & Countdowns**:
  - Added a live digital system clock (e.g. `🕒 Waktu: 15:41:45`) at the top of the System Tray menu that updates every second.
  - Added real-time remaining countdown minutes (e.g. `💧 Minum Air: 0/8 (55m)`) for each active health reminder in the tray menu.
  - Optimized the background thread loop to update the system tray menu every second while only sending state ticks to the React frontend on actual state updates to conserve resources.
- **Start/Stop Health Reminders**:
  - Replaced the simple toggle switch in each health reminder card with segmented **Start** and **Stop** button controls.
  - Added visual styling to clearly indicate running and stopped states (with theme color glow for Start and a dark solid gray background for Stop).
- **Browser Mock Layer Tick**:
  - Updated mock state updates to trigger state ticks every second in browser development mode, ensuring countdowns tick down smoothly in browser UI.

## [0.1.12] - 2026-07-14

### Added
- **Auto-Updater Support (Tauri v2)**: Enabled Tauri's native auto-updater plugin to automatically check, download, and install newer versions of the app.
- **GitHub Action Release Workflow**: Configured CI/CD workflow to compile, bundle, and sign installers for Windows, macOS, and Linux, and draft GitHub Releases when a new tag is pushed.
- **UI Version & Update Controls**: Displayed the current running version in the sidebar navigation footer. Added a card in the Settings panel allowing users to manually check for updates, view progress, and restart the app to apply them (with mock simulations in browser mode).

## [0.1.11] - 2026-07-14

### Added
- **Pomodoro System Tray Live Countdown**:
  - Replaced the simple completed sessions counter in the tray menu with a live Pomodoro timer countdown.
  - The menu item dynamically updates every second to display the current mode and time remaining (e.g. `⏱️ Fokus: 24:15` or `⏱️ Istirahat Pendek: 04:59`) along with its running/paused/ready state.
  - Multi-line system tray icon tooltip now shows a full summary containing the active phase timer and completed sessions count.

## [0.1.10] - 2026-07-14

### Added
- **System Tray Counter & Progress Tracker**:
  - Replaced the simple static system tray menu with a dynamic wellness dashboard menu.
  - Added real-time counters displaying the today's counts: Pomodoro completed sessions and progress for each active health reminder (e.g. 💧 Minum Air: 0/8, 🏃 Peregangan: 0/4, etc.).
  - Enabled **direct logging from the system tray**; users can now click any reminder item in the system tray menu to instantly log progress without opening the main window.
  - Tooltips for the system tray icon now display a summary of the Pomodoro session completion.

## [0.1.9] - 2026-07-14

### Added
- **Pomodoro Play Sound Effect**: Integrated a sleek, modern ascending double-chime sound effect synthesized using Web Audio API that plays instantly whenever the user starts or resumes the Pomodoro timer, provided sound effects are enabled.

## [0.1.8] - 2026-07-14

### Added
- **Multi-Platform Native Icons**: Used the Tauri CLI icon generator to produce native icon formats (`icon.ico` for Windows, `icon.icns` for macOS, and multi-resolution PNGs for iOS/Android) using the new glowing heart-brain logo.
- **System Tray Icon**: Updated the system tray icon on the desktop to match the customized dark neon wellness design.

## [0.1.7] - 2026-07-14

### Added
- **Premium Branding Assets**: Generated a customized desktop logo for 'Kerja Sehat' featuring a glowing hybrid symbol representing both physical health (heart) and focus/mindfulness (brain), styled with a premium dark neon theme.
- **Sidebar Integration**: Integrated the new logo asset (`/kerja_sehat_logo.png`) directly in the frameless sidebar branding section of the app.
- **Tauri Bundle Icon**: Updated the master icon resource file (`icon.png`) for building native desktop platform packages.

## [0.1.6] - 2026-07-14

### Added
- **Customizable Notification Texts**: Added text inputs under each health reminder in the Settings panel. Users can now directly customize both the title (label) and the notification message (body) for water, stretch, eye rest, posture, and any custom reminders.

## [0.1.5] - 2026-07-14

### Added
- **Notification Sound Effects**: Synthesized premium, pleasant chime sounds for both health reminders (sine double-chime) and Pomodoro session completions (triplet sine chords) using the native browser Web Audio API.
- **Audio Settings Controls**: Integrated a dedicated Sound Settings card in the Settings panel with a toggle switch to enable/disable sound effects, along with test-play buttons to demo the sounds instantly.

## [0.1.4] - 2026-07-14

### Added
- **Custom Reminders Management**: Added a feature in the Settings panel to create new custom reminders (with custom label, message, interval, and daily target) and delete custom reminders.
- **Dynamic Dashboard Icons**: Custom reminders automatically render with a Sparkles icon and an Indigo color scheme to visually stand out.

## [0.1.3] - 2026-07-14

### Added
- **Multi-Language Support**: Added full English and Indonesian translations.
- **Language Switcher**: Added a quick switch toggle (ID/EN) in the top stats header and a primary Language selection card in the Settings panel.
- **Dynamic Localization**: Automatically translates dashboard reminders, Pomodoro phase labels, timer states, confirmation hover buttons, system notifications, and system tray menus dynamically upon changing the language.

## [0.1.2] - 2026-07-14

### Added
- **Frameless Window**: Removed system title bar (`decorations: false`, `transparent: true`) for a cleaner modern look.
- **Custom Window Controls**: Added macOS-style minimize (yellow), maximize (green), and close (red) dot buttons in the sidebar header.
- **Drag Region**: Sidebar logo area is marked as `data-tauri-drag-region` so the window can be dragged freely.

## [0.1.1] - 2026-07-14

### Added
- **Browser Compatibility Mock Layer**: Created a mock layer (`src/lib/tauri.ts`) that intercepts Tauri IPC commands and events (`invoke` and `listen`) to allow full web-browser testing without throwing `TypeError`.

### Fixed
- Frontend crash on start when running outside a Tauri webview container (e.g., standard browser window).

## [0.1.0] - 2026-07-14

### Added
- **Project Structure**: Initialized a new Tauri v2 + React TypeScript desktop app boilerplate.
- **Tailwind CSS & shadcn/ui**: Configured path aliases, CSS variables, dark theme background colors, custom SVGs, and card layouts.
- **Rust Backend State Manager**:
  - Thread-safe `AppState` storing reminders (Water, Stretch, Eye, Posture) and Pomodoro schedules.
  - Background asynchronous tokio loop monitoring reminder deadlines.
  - Active native desktop notification triggers using `tauri-plugin-notification`.
  - Midnight check task to reset daily logged progress counts.
- **System Tray Integration**:
  - Customized system tray icon and dropdown menu options ("Buka Aplikasi", "Keluar Kerja Sehat").
  - Intercepted window close requests to hide the window instead of killing the app process.
- **Frontend Dashboard Application**:
  - **Dashboard View**: Progress tracker bar, active status cards, switches, next countdown timers, and logging buttons.
  - **Pomodoro View**: Interactive SVG progress ring, format clock, Play/Pause/Reset/Skip controls, and workflow summaries.
  - **Settings View**: Form input fields allowing customization of all intervals, targets, and Pomodoro session timings.
- **Customization Settings**: Created [.agents/AGENTS.md](file:///d:/backup%20from%20pc%20asus/Documents%20Development/kerja-sehat-app/.agents/AGENTS.md) to define style guidelines and version bump/maintainability requirements.
