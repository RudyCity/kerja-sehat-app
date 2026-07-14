# Kerja Sehat (Healthy Work) Application

A premium, modern desktop wellness application built using **Rust Tauri v2**, **React**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components.

This application is designed to help professionals maintain physical and mental well-being while working at their computers. It offers customisable periodic health reminders and a Pomodoro focus timer.

## Features

### 1. Dashboard Kesehatan (Periodic Reminders)
- **Minum Air (Water Intake)**: Tracks daily hydration goals.
- **Peregangan (Stretching/Walk)**: Reminds you to stand up, walk, and stretch to prevent muscle fatigue.
- **Istirahat Mata (Eye Rest - 20-20-20 rule)**: Prompts you to look 20 feet away for 20 seconds every 20 minutes to reduce eye strain.
- **Periksa Postur (Posture Check)**: Reminds you to adjust sitting posture and relax shoulders.
- **Tauri Background Thread Integration**: Reminders are monitored on a Rust background thread so notifications fire reliably even if the webview is throttled or suspended by the OS.
- **Midnight Reset**: Automatically resets daily progress logging counts at midnight.

### 2. Pomodoro Timer
- Standard focus session (25m) and break cycles (5m short break, 15m long break after 4 focus sessions).
- Gorgeous SVG circular countdown indicator matching active modes (indigo for focus, emerald for short breaks, cyan for long breaks).
- Smooth local counting synchronization with Rust backend.
- System tray minimization: Intercepts close button events to keep the application active in the tray.

### 3. Settings Configuration
- Customize intervals (in minutes) and daily targets for all health reminders.
- Configure custom Pomodoro durations (Focus, Short Break, Long Break).
- Easy toggle switches to enable/disable specific reminders.

---

## Technical Architecture

- **Backend (Rust)**:
  - Maintains application state using `tauri::State` with thread-safe `Mutex`.
  - Runs an asynchronous background monitoring thread looping every 1 second.
  - Controls desktop notifications via `tauri-plugin-notification`.
  - Emits real-time `"state-tick"` events containing serialised state objects to the frontend.
  - Handles tray icon lifecycle events and window close interception.
- **Frontend (React & TypeScript)**:
  - Renders a responsive glassmorphic dashboard utilizing **Tailwind CSS** and **shadcn/ui**.
  - Synchronises UI timers seamlessly with the backend's target epoch timestamps.

---

## Installation & Getting Started

### Prerequisites
- Node.js (v18+) & npm
- Rust compiler and Cargo toolchain

### Development Mode
To run the application locally with hot-reloading:
```powershell
$env:PATH += ";C:\Users\USER\.cargo\bin"; npm run tauri dev
```

### Production Build
To package the app into a production-ready installer (`.exe`):
```powershell
$env:PATH += ";C:\Users\USER\.cargo\bin"; npm run tauri build
```

---

## Project Customization Rules
All development in this repository follows the guidelines specified in [.agents/AGENTS.md](file:///d:/backup%20from%20pc%20asus/Documents%20Development/kerja-sehat-app/.agents/AGENTS.md). Notable rules include:
- Files **MUST NOT** exceed 1000 lines. Keep code modular.
- Every release must bump the version and update the changelog.
