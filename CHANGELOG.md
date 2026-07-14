# Changelog

All notable changes to the **Kerja Sehat** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
