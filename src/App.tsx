import { useState, useEffect, useRef } from "react";
import { invoke, listen, isTauri } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { 
  Droplet, 
  Activity, 
  Eye, 
  Heart, 
  Brain, 
  Settings, 
  Bell, 
  Check,
  Sparkles,
  Minus,
  Square,
  X,
  Trash2,
  Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditableNumberField } from "@/components/EditableNumberField";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { HealthDashboard } from "@/components/HealthDashboard";
import { translations, Language } from "@/components/i18n";
import { playNotificationSound } from "@/lib/sound";

// Interfaces matching Rust structures
interface Reminder {
  id: string;
  label: string;
  interval_minutes: number;
  next_trigger: number | null;
  is_enabled: boolean;
  progress_count: number;
  progress_target: number;
  message: string;
}

interface Pomodoro {
  mode: "focus" | "shortbreak" | "longbreak";
  state: "idle" | "running" | "paused";
  focus_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  current_duration: number;
  time_left: number;
  target_timestamp: number | null;
  sessions_completed: number;
}

interface AppState {
  reminders: Reminder[];
  pomodoro: Pomodoro;
  last_reset_date: string;
  language: string;
  sound_enabled: boolean;
}

// Window control helpers (only active inside Tauri)
const handleWindowControl = async (action: "minimize" | "maximize" | "close") => {
  if (!isTauri()) return;
  try {
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    else if (action === "maximize") await win.toggleMaximize();
    else if (action === "close") await win.close();
  } catch (e) {
    console.error("Window control error:", e);
  }
};

function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pomodoro" | "settings">("dashboard");
  const [state, setState] = useState<AppState | null>(null);
  
  // Create a ref for state to access it in event listeners without re-binding them
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;
  
  // Local time left state to ensure smooth UI tick
  const [localPomodoroTime, setLocalPomodoroTime] = useState<number>(25 * 60);

  // Settings form states
  const [pomSettings, setPomSettings] = useState({ focus: 25, short: 5, long: 15 });
  const [reminderSettings, setReminderSettings] = useState<Record<string, { label: string; message: string; interval: number; target: number }>>({});

  // Add Custom Reminder form states
  const [newLabel, setNewLabel] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newInterval, setNewInterval] = useState(30);
  const [newTarget, setNewTarget] = useState(8);

  const lang: Language = (state?.language as Language) || "id";
  const t = translations[lang];

  // Fetch state on mount
  useEffect(() => {
    invoke<AppState>("get_state").then((initialState) => {
      setState(initialState);
      setLocalPomodoroTime(initialState.pomodoro.time_left);
      
      // Initialize settings form states
      setPomSettings({
        focus: initialState.pomodoro.focus_duration,
        short: initialState.pomodoro.short_break_duration,
        long: initialState.pomodoro.long_break_duration,
      });

      const initialRemSettings: Record<string, { label: string; message: string; interval: number; target: number }> = {};
      initialState.reminders.forEach((r) => {
        initialRemSettings[r.id] = { label: r.label, message: r.message, interval: r.interval_minutes, target: r.progress_target };
      });
      setReminderSettings(initialRemSettings);
    });

    // Listen to background ticks
    let unlisten: (() => void) | null = null;
    listen<AppState>("state-tick", (event) => {
      setState(event.payload);
      // Sync local timer only if not running or if drift is significant
      if (event.payload.pomodoro.state !== "running" || Math.abs(event.payload.pomodoro.time_left - localPomodoroTime) > 2) {
        setLocalPomodoroTime(event.payload.pomodoro.time_left);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    let unlistenReminder: (() => void) | null = null;
    listen<string>("reminder-triggered", () => {
      if (stateRef.current?.sound_enabled) {
        playNotificationSound("reminder");
      }
    }).then((fn) => {
      unlistenReminder = fn;
    });

    let unlistenPomodoro: (() => void) | null = null;
    listen<string>("pomodoro-triggered", () => {
      if (stateRef.current?.sound_enabled) {
        playNotificationSound("pomodoro");
      }
    }).then((fn) => {
      unlistenPomodoro = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (unlistenReminder) unlistenReminder();
      if (unlistenPomodoro) unlistenPomodoro();
    };
  }, []);

  // Smooth local timer ticks
  useEffect(() => {
    let interval: number;
    if (state?.pomodoro.state === "running") {
      interval = window.setInterval(() => {
        setLocalPomodoroTime((prev) => {
          if (prev <= 1) {
            // Let the backend handle the mode transition and trigger notification,
            // we just lock it at 0 until state updates from backend
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state?.pomodoro.state]);

  // Sync settings when state loads/changes
  useEffect(() => {
    if (state) {
      const initialRemSettings: Record<string, { label: string; message: string; interval: number; target: number }> = {};
      state.reminders.forEach((r) => {
        initialRemSettings[r.id] = { label: r.label, message: r.message, interval: r.interval_minutes, target: r.progress_target };
      });
      setReminderSettings(initialRemSettings);
    }
  }, [state?.reminders]);

  if (!state) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#030712] text-white">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium tracking-wide text-zinc-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  const getReminderIcon = (id: string) => {
    switch (id) {
      case "water": return <Droplet className="h-5 w-5 text-sky-400" />;
      case "stretch": return <Activity className="h-5 w-5 text-emerald-400" />;
      case "eye": return <Eye className="h-5 w-5 text-amber-400" />;
      case "posture": return <Heart className="h-5 w-5 text-rose-400" />;
      default: return <Sparkles className="h-5 w-5 text-indigo-400" />;
    }
  };

  const getReminderAccentColor = (id: string) => {
    switch (id) {
      case "water": return "text-sky-400";
      case "stretch": return "text-emerald-400";
      case "eye": return "text-amber-400";
      case "posture": return "text-rose-400";
      default: return "text-indigo-400";
    }
  };

  // Commands triggers
  const handleToggleReminder = async (id: string, enabled: boolean) => {
    const newState = await invoke<AppState>("toggle_reminder", { id, enabled });
    setState(newState);
  };

  const handleLogProgress = async (id: string) => {
    const newState = await invoke<AppState>("log_reminder_progress", { id });
    setState(newState);
  };

  const handleToggleSound = async (enabled: boolean) => {
    const newState = await invoke<AppState>("toggle_sound", { enabled });
    setState(newState);
  };

  const handleControlPomodoro = async (action: "start" | "pause" | "reset" | "skip") => {
    const newState = await invoke<AppState>("control_pomodoro", { action });
    setState(newState);
    setLocalPomodoroTime(newState.pomodoro.time_left);
    if (action === "start" && newState.sound_enabled) {
      playNotificationSound("play");
    }
  };

  const handleSetLanguage = async (lang: "id" | "en") => {
    const newState = await invoke<AppState>("set_language", { lang });
    setState(newState);
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newMessage.trim()) {
      alert(t.fill_all_fields);
      return;
    }
    const newState = await invoke<AppState>("add_custom_reminder", {
      label: newLabel,
      intervalMinutes: newInterval,
      target: newTarget,
      message: newMessage,
    });
    setState(newState);
    setNewLabel("");
    setNewMessage("");
    setNewInterval(30);
    setNewTarget(8);
    alert(t.reminder_added);
  };

  const handleDeleteReminder = async (id: string) => {
    const confirmed = window.confirm(lang === "en" ? "Are you sure you want to delete this reminder?" : "Apakah Anda yakin ingin menghapus pengingat ini?");
    if (confirmed) {
      const newState = await invoke<AppState>("delete_reminder", { id });
      setState(newState);
      const { [id]: _, ...rest } = reminderSettings;
      setReminderSettings(rest);
      alert(t.reminder_deleted);
    }
  };

  const handleSaveSettings = async () => {
    // 1. Save Pomodoro Settings
    let newState = await invoke<AppState>("update_pomodoro_settings", {
      focus: pomSettings.focus,
      short: pomSettings.short,
      long: pomSettings.long,
    });

    // 2. Save Reminders Settings
    for (const id of Object.keys(reminderSettings)) {
      newState = await invoke<AppState>("update_reminder_settings", {
        id,
        label: reminderSettings[id].label,
        message: reminderSettings[id].message,
        intervalMinutes: reminderSettings[id].interval,
        target: reminderSettings[id].target,
      });
    }

    setState(newState);
    setLocalPomodoroTime(newState.pomodoro.time_left);
    alert(t.settings_saved);
  };


  // Calculate total target reminder progress
  const totalCompleted = state.reminders.reduce((acc, r) => acc + r.progress_count, 0);
  const totalTarget = state.reminders.reduce((acc, r) => acc + r.progress_target, 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent font-sans text-white">
      {/* Sidebar Navigation */}
      <div className="flex w-64 flex-col border-r border-white/5 bg-slate-950/60 backdrop-blur-xl">

        {/* Sidebar Title Bar (drag region, sejajar dengan title bar kanan) */}
        <div
          data-tauri-drag-region
          className="flex h-9 shrink-0 items-center px-6 select-none border-b border-white/5"
        >
          <div className="flex items-center gap-2.5 pointer-events-none">
            <img src="/kerja_sehat_logo.png" alt="Logo" className="h-5 w-5 rounded-md object-cover shadow shadow-indigo-500/25" />
            <span className="text-xs font-bold tracking-tight text-white/80">Kerja Sehat</span>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex flex-1 flex-col justify-between p-5 overflow-hidden">
          <div className="flex flex-col gap-2">

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Activity className="h-4.5 w-4.5" />
                {t.dashboard}
              </button>
              <button
                onClick={() => setActiveTab("pomodoro")}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                  activeTab === "pomodoro"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Brain className="h-4.5 w-4.5" />
                {t.pomodoro}
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                  activeTab === "settings"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Settings className="h-4.5 w-4.5" />
                {t.settings}
              </button>
            </nav>
          </div>

          {/* Footer Sidebar */}
          <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-4 border border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-semibold text-zinc-300">{t.quote_title}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400 italic">
              {t.quote_desc}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col bg-black/30 backdrop-blur-md">
        {/* Title Bar with Window Controls */}
        <div
          data-tauri-drag-region
          className="flex h-9 shrink-0 items-center justify-end select-none border-b border-white/5 bg-transparent"
        >
          <div className="flex items-center">
            <button
              onClick={() => handleWindowControl("minimize")}
              className="flex h-9 w-11 items-center justify-center text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleWindowControl("maximize")}
              className="flex h-9 w-11 items-center justify-center text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Maximize"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleWindowControl("close")}
              className="flex h-9 w-11 items-center justify-center text-zinc-400 transition-colors hover:bg-red-500 hover:text-white rounded-tr-none"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {activeTab === "dashboard" && t.dashboard}
              {activeTab === "pomodoro" && t.pomodoro}
              {activeTab === "settings" && t.settings_app}
            </h2>
            <p className="text-xs text-zinc-400">
              {activeTab === "dashboard" && t.dashboard_desc}
              {activeTab === "pomodoro" && t.pomodoro_desc}
              {activeTab === "settings" && t.settings_desc}
            </p>
          </div>

          {/* Quick Stats on Top */}
          <div className="flex items-center gap-4 rounded-xl bg-slate-900/40 p-2.5 border border-white/5 text-xs">
            {/* Quick Language Switcher */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => handleSetLanguage("id")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  lang === "id" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
              <button
                onClick={() => handleSetLanguage("en")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  lang === "en" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
                title="English"
              >
                EN
              </button>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col px-3">
              <span className="text-zinc-500 font-medium">{t.focus_session}</span>
              <span className="text-sm font-bold text-indigo-400">{state.pomodoro.sessions_completed} {t.completed}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col px-3">
              <span className="text-zinc-500 font-medium">{t.today}</span>
              <span className="text-sm font-bold text-emerald-400">{overallPercentage}% {t.completed}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <HealthDashboard
            reminders={state.reminders}
            pomodoro={state.pomodoro}
            onToggle={handleToggleReminder}
            onLog={handleLogProgress}
            lang={lang}
          />
        )}

        {/* Pomodoro Tab */}
        {activeTab === "pomodoro" && (
          <div className="flex flex-col items-center justify-center py-6">
            <PomodoroTimer
              pomodoro={state.pomodoro}
              localTime={localPomodoroTime}
              onControl={handleControlPomodoro}
              lang={lang}
            />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-6 max-w-2xl">
            {/* Language Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  {t.language_label}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.language_desc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex gap-4">
                <button
                  onClick={() => handleSetLanguage("id")}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-between ${
                    lang === "id"
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-white/5 bg-white/5 text-zinc-400 hover:border-white/10"
                  }`}
                >
                  <span>Bahasa Indonesia</span>
                  {lang === "id" && <Check className="h-4 w-4 text-indigo-400" />}
                </button>
                <button
                  onClick={() => handleSetLanguage("en")}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-between ${
                    lang === "en"
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-white/5 bg-white/5 text-zinc-400 hover:border-white/10"
                  }`}
                >
                  <span>English</span>
                  {lang === "en" && <Check className="h-4 w-4 text-indigo-400" />}
                </button>
              </CardContent>
            </Card>

            {/* Sound Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Volume2 className="h-5 w-5 text-indigo-400" />
                  {t.sound_settings_title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.sound_settings_desc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">{t.sound_enabled_label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{t.sound_enabled_desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleSound(!state.sound_enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${
                        state.sound_enabled ? "bg-indigo-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          state.sound_enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => playNotificationSound("reminder")}
                    className="flex-1 h-10 px-4 bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Volume2 className="h-4 w-4 text-indigo-400" />
                    {t.test_sound_button} (Reminder)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => playNotificationSound("pomodoro")}
                    className="flex-1 h-10 px-4 bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    {t.test_sound_button} (Pomodoro)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pomodoro Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Brain className="h-5 w-5 text-indigo-400" />
                  {t.pomodoro_duration}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.pomodoro_duration_desc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 grid grid-cols-3 gap-4">
                <EditableNumberField
                  id="focus-dur"
                  label={t.focus_work}
                  value={pomSettings.focus}
                  unit={t.minutes_unit}
                  min={1}
                  max={180}
                  accentColor="text-indigo-400"
                  onChange={(v) => setPomSettings({ ...pomSettings, focus: v })}
                  lang={lang}
                />
                <EditableNumberField
                  id="short-dur"
                  label={t.short_break}
                  value={pomSettings.short}
                  unit={t.minutes_unit}
                  min={1}
                  max={60}
                  accentColor="text-emerald-400"
                  onChange={(v) => setPomSettings({ ...pomSettings, short: v })}
                  lang={lang}
                />
                <EditableNumberField
                  id="long-dur"
                  label={t.long_break}
                  value={pomSettings.long}
                  unit={t.minutes_unit}
                  min={1}
                  max={120}
                  accentColor="text-cyan-400"
                  onChange={(v) => setPomSettings({ ...pomSettings, long: v })}
                  lang={lang}
                />
              </CardContent>
            </Card>

            {/* Healthy Reminders Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Bell className="h-5 w-5 text-indigo-400" />
                  {t.periodic_reminders}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.periodic_reminders_desc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex flex-col gap-5">
                {state.reminders.map((r) => {
                  const item = reminderSettings[r.id] || { 
                    label: r.label, 
                    message: r.message, 
                    interval: r.interval_minutes, 
                    target: r.progress_target 
                  };
                  return (
                    <div key={r.id} className="flex flex-col gap-3.5 border-b border-white/5 pb-5 last:border-0 last:pb-0">
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                        {/* Reminder Label */}
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                            {getReminderIcon(r.id)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.label || r.label}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t.active_reminder_status}</p>
                          </div>
                        </div>
                        {/* Interval */}
                        <EditableNumberField
                          id={`interval-${r.id}`}
                          label={t.interval}
                          value={item.interval}
                          unit={t.minutes_unit}
                          min={5}
                          max={360}
                          accentColor={getReminderAccentColor(r.id)}
                          onChange={(v) => setReminderSettings({
                            ...reminderSettings,
                            [r.id]: { ...item, interval: v }
                          })}
                          lang={lang}
                        />
                        {/* Target */}
                        <EditableNumberField
                          id={`target-${r.id}`}
                          label={t.target_per_day}
                          value={item.target}
                          unit={t.times_unit}
                          min={1}
                          max={100}
                          accentColor={getReminderAccentColor(r.id)}
                          onChange={(v) => setReminderSettings({
                            ...reminderSettings,
                            [r.id]: { ...item, target: v }
                          })}
                          lang={lang}
                        />
                        {/* Action */}
                        <div className="flex items-center justify-center">
                          {r.id.startsWith("custom_") ? (
                            <button
                              onClick={() => handleDeleteReminder(r.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-white transition-all active:scale-95"
                              title={t.delete}
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          ) : (
                            <div className="h-9 w-9" />
                          )}
                        </div>
                      </div>

                      {/* Customize Text Inputs */}
                      <div className="grid grid-cols-2 gap-4 mt-1 pl-12">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            {t.reminder_name_label}
                          </label>
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => setReminderSettings({
                              ...reminderSettings,
                              [r.id]: { ...item, label: e.target.value }
                            })}
                            className="w-full rounded-xl border border-white/5 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            {t.reminder_msg_label}
                          </label>
                          <input
                            type="text"
                            value={item.message}
                            onChange={(e) => setReminderSettings({
                              ...reminderSettings,
                              [r.id]: { ...item, message: e.target.value }
                            })}
                            className="w-full rounded-xl border border-white/5 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Add Custom Reminder Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  {t.add_custom_reminder_title}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.add_custom_reminder_desc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <form onSubmit={handleAddReminder} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t.reminder_name_label}
                      </label>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder={t.reminder_name_placeholder}
                        className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t.reminder_msg_label}
                      </label>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t.reminder_msg_placeholder}
                        className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t.reminder_interval_label}
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={360}
                        value={newInterval}
                        onChange={(e) => setNewInterval(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t.reminder_target_label}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={newTarget}
                        onChange={(e) => setNewTarget(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/30 focus:bg-indigo-500/5 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <Button
                      type="submit"
                      className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/25 border border-indigo-500/20"
                    >
                      {t.add_button}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Actions panel */}
            <div className="flex items-center justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (state) {
                    setPomSettings({
                      focus: state.pomodoro.focus_duration,
                      short: state.pomodoro.short_break_duration,
                      long: state.pomodoro.long_break_duration,
                    });
                    const resettings: Record<string, { label: string; message: string; interval: number; target: number }> = {};
                    state.reminders.forEach((r) => {
                      resettings[r.id] = { label: r.label, message: r.message, interval: r.interval_minutes, target: r.progress_target };
                    });
                    setReminderSettings(resettings);
                  }
                }}
                className="h-11 px-6 bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white rounded-xl"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleSaveSettings}
                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-indigo-600/20 shadow-lg border border-indigo-500/20 rounded-xl"
              >
                {t.save_changes}
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default App;
