import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Droplet, 
  Activity, 
  Eye, 
  Heart, 
  Brain, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Clock, 
  Bell, 
  Check,
  TrendingUp,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pomodoro" | "settings">("dashboard");
  const [state, setState] = useState<AppState | null>(null);
  
  // Local time left state to ensure smooth UI tick
  const [localPomodoroTime, setLocalPomodoroTime] = useState<number>(25 * 60);

  // Settings form states
  const [pomSettings, setPomSettings] = useState({ focus: 25, short: 5, long: 15 });
  const [reminderSettings, setReminderSettings] = useState<Record<string, { interval: number; target: number }>>({});

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

      const initialRemSettings: Record<string, { interval: number; target: number }> = {};
      initialState.reminders.forEach((r) => {
        initialRemSettings[r.id] = { interval: r.interval_minutes, target: r.progress_target };
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

    return () => {
      if (unlisten) unlisten();
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
      const initialRemSettings: Record<string, { interval: number; target: number }> = {};
      state.reminders.forEach((r) => {
        initialRemSettings[r.id] = { interval: r.interval_minutes, target: r.progress_target };
      });
      setReminderSettings(initialRemSettings);
    }
  }, [state?.reminders]);

  if (!state) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#030712] text-white">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium tracking-wide text-zinc-400">Memuat data Kerja Sehat...</p>
        </div>
      </div>
    );
  }

  // Formatting helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getReminderIcon = (id: string) => {
    switch (id) {
      case "water": return <Droplet className="h-5 w-5 text-sky-400" />;
      case "stretch": return <Activity className="h-5 w-5 text-emerald-400" />;
      case "eye": return <Eye className="h-5 w-5 text-amber-400" />;
      case "posture": return <Heart className="h-5 w-5 text-rose-400" />;
      default: return <Sparkles className="h-5 w-5 text-indigo-400" />;
    }
  };

  const getReminderColorClass = (id: string) => {
    switch (id) {
      case "water": return "from-sky-500/20 to-blue-500/5 border-sky-500/20 hover:border-sky-500/40 text-sky-400";
      case "stretch": return "from-emerald-500/20 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400";
      case "eye": return "from-amber-500/20 to-orange-500/5 border-amber-500/20 hover:border-amber-500/40 text-amber-400";
      case "posture": return "from-rose-500/20 to-pink-500/5 border-rose-500/20 hover:border-rose-500/40 text-rose-400";
      default: return "from-indigo-500/20 to-purple-500/5 border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400";
    }
  };

  const getReminderProgressColor = (id: string) => {
    switch (id) {
      case "water": return "bg-sky-500";
      case "stretch": return "bg-emerald-500";
      case "eye": return "bg-amber-500";
      case "posture": return "bg-rose-500";
      default: return "bg-indigo-500";
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

  const handleControlPomodoro = async (action: "start" | "pause" | "reset" | "skip") => {
    const newState = await invoke<AppState>("control_pomodoro", { action });
    setState(newState);
    setLocalPomodoroTime(newState.pomodoro.time_left);
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
        intervalMinutes: reminderSettings[id].interval,
        target: reminderSettings[id].target,
      });
    }

    setState(newState);
    setLocalPomodoroTime(newState.pomodoro.time_left);
    alert("Pengaturan berhasil disimpan!");
  };

  // Calculate Remaining Time for Reminders
  const getReminderCountdown = (reminder: Reminder) => {
    if (!reminder.is_enabled || !reminder.next_trigger) return "Nonaktif";
    const now = Math.floor(Date.now() / 1000);
    const diff = reminder.next_trigger - now;
    if (diff <= 0) return "Menunggu tindakan...";
    
    const mins = Math.floor(diff / 60);
    if (mins === 0) return "Kurang dari semenit";
    return `${mins} menit lagi`;
  };

  // Pomodoro details helper
  const getPomodoroModeLabel = (mode: Pomodoro["mode"]) => {
    switch (mode) {
      case "focus": return "Fokus Kerja";
      case "shortbreak": return "Istirahat Pendek";
      case "longbreak": return "Istirahat Panjang";
    }
  };

  const getPomodoroColorClass = (mode: Pomodoro["mode"]) => {
    switch (mode) {
      case "focus": return "text-indigo-400 border-indigo-500";
      case "shortbreak": return "text-emerald-400 border-emerald-500";
      case "longbreak": return "text-cyan-400 border-cyan-500";
    }
  };

  const getPomodoroProgressColor = (mode: Pomodoro["mode"]) => {
    switch (mode) {
      case "focus": return "#6366f1";
      case "shortbreak": return "#10b981";
      case "longbreak": return "#06b6d4";
    }
  };

  // Calculate total target reminder progress
  const totalCompleted = state.reminders.reduce((acc, r) => acc + r.progress_count, 0);
  const totalTarget = state.reminders.reduce((acc, r) => acc + r.progress_target, 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent font-sans text-white">
      {/* Sidebar Navigation */}
      <div className="flex w-64 flex-col justify-between border-r border-white/5 bg-slate-950/60 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Kerja Sehat</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400/80">Wellness Tracker</span>
            </div>
          </div>

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
              Dashboard Kesehatan
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
              Pomodoro Timer
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
              Pengaturan
            </button>
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-4 border border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-300">Quote Sehat</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400 italic">
            "Kesehatan Anda adalah investasi terbaik untuk produktivitas Anda."
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-black/30 p-8 backdrop-blur-md">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {activeTab === "dashboard" && "Dashboard Kesehatan"}
              {activeTab === "pomodoro" && "Pomodoro Timer"}
              {activeTab === "settings" && "Pengaturan Aplikasi"}
            </h2>
            <p className="text-xs text-zinc-400">
              {activeTab === "dashboard" && "Monitor aktivitas fisik dan kebutuhan hidrasi Anda saat bekerja."}
              {activeTab === "pomodoro" && "Tetap fokus dan selingi dengan istirahat teratur untuk kesehatan optimal."}
              {activeTab === "settings" && "Konfigurasi interval pengingat dan durasi sesi sesuai kebutuhan Anda."}
            </p>
          </div>

          {/* Quick Stats on Top */}
          <div className="flex items-center gap-4 rounded-xl bg-slate-900/40 p-2.5 border border-white/5 text-xs">
            <div className="flex flex-col px-3">
              <span className="text-zinc-500 font-medium">Sesi Fokus</span>
              <span className="text-sm font-bold text-indigo-400">{state.pomodoro.sessions_completed} Selesai</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col px-3">
              <span className="text-zinc-500 font-medium">Hari Ini</span>
              <span className="text-sm font-bold text-emerald-400">{overallPercentage}% Selesai</span>
            </div>
          </div>
        </header>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6">
            {/* Progress Overview Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/50 via-purple-950/20 to-black/30 p-6 border border-indigo-500/10">
              <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Target Harian</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Aktivitas Kesehatan Anda Hari Ini</h3>
                  <p className="text-xs text-zinc-400 max-w-lg leading-normal">
                    Penuhi seluruh indikator kesehatan harian Anda dengan mematuhi pengingat di bawah ini untuk mencegah kelelahan fisik.
                  </p>
                </div>
                <div className="flex items-center gap-4 md:w-80">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-zinc-300">Kemajuan</span>
                      <span className="text-indigo-400">{overallPercentage}%</span>
                    </div>
                    <Progress value={overallPercentage} className="h-2.5 bg-zinc-800" indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-500" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <TrendingUp className="h-6 w-6 text-indigo-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Reminders Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {state.reminders.map((reminder) => (
                <Card 
                  key={reminder.id} 
                  className={`relative overflow-hidden border bg-gradient-to-b ${getReminderColorClass(reminder.id)}`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 border border-white/5 shadow-inner">
                        {getReminderIcon(reminder.id)}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-white">{reminder.label}</CardTitle>
                        <CardDescription className="text-[10px] text-zinc-400 mt-0.5">
                          Setiap {reminder.interval_minutes} menit • Target: {reminder.progress_target} kali
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={reminder.is_enabled}
                      onCheckedChange={(checked) => handleToggleReminder(reminder.id, checked)}
                      className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-zinc-800"
                    />
                  </CardHeader>
                  <CardContent className="pb-3 text-xs leading-normal text-zinc-300">
                    <p className="min-h-[32px]">{reminder.message}</p>
                    
                    {/* Log Progress Segment */}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] font-semibold text-zinc-400 mb-1">
                          <span>Progress</span>
                          <span>{reminder.progress_count} / {reminder.progress_target} Selesai</span>
                        </div>
                        <Progress 
                          value={Math.min(100, (reminder.progress_count / reminder.progress_target) * 100)} 
                          className="h-2 bg-black/30" 
                          indicatorClassName={getReminderProgressColor(reminder.id)}
                        />
                      </div>
                      
                      <Button
                        size="sm"
                        disabled={!reminder.is_enabled}
                        onClick={() => handleLogProgress(reminder.id)}
                        className="h-8 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/5 shadow-sm transition-all"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Log
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-3.5 px-6 flex justify-between items-center text-[10px] text-zinc-500 border-t border-white/5 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      <span>Reminder selanjutnya:</span>
                    </div>
                    <span className="font-semibold text-zinc-400">{getReminderCountdown(reminder)}</span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pomodoro Tab */}
        {activeTab === "pomodoro" && (
          <div className="flex flex-col items-center justify-center gap-8 py-4">
            {/* Main Interactive Circle */}
            <div className="relative flex h-80 w-80 items-center justify-center rounded-full bg-slate-950/20 p-2 shadow-2xl border border-white/5">
              {/* Outer Glow Ring */}
              <div className={`absolute inset-0 rounded-full border border-white/5 blur-sm opacity-50 ${state.pomodoro.state === "running" ? "animate-pulse-ring" : ""}`} />
              
              {/* SVG Circle Progress */}
              <svg className="absolute inset-0 h-full w-full -rotate-90">
                <circle
                  cx="160"
                  cy="160"
                  r="144"
                  className="stroke-zinc-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="144"
                  stroke={getPomodoroProgressColor(state.pomodoro.mode)}
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 144}
                  strokeDashoffset={
                    2 * Math.PI * 144 * (1 - localPomodoroTime / state.pomodoro.current_duration)
                  }
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              {/* Inside Text details */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <span className={`text-xs font-bold uppercase tracking-widest ${getPomodoroColorClass(state.pomodoro.mode)}`}>
                  {getPomodoroModeLabel(state.pomodoro.mode)}
                </span>
                <span className="my-2 text-6xl font-black tabular-nums tracking-tighter text-white text-glow-indigo">
                  {formatTime(localPomodoroTime)}
                </span>
                <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 border border-white/5 text-[10px] text-zinc-400">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  <span>Sesi fokus ke-{state.pomodoro.sessions_completed + 1}</span>
                </div>
              </div>
            </div>

            {/* Controls panel */}
            <div className="flex items-center gap-4 rounded-2xl bg-slate-900/40 p-4 border border-white/5 shadow-lg max-w-sm w-full justify-center">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleControlPomodoro("reset")}
                className="h-11 w-11 rounded-xl bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>

              {state.pomodoro.state === "running" ? (
                <Button
                  size="lg"
                  onClick={() => handleControlPomodoro("pause")}
                  className="h-13 w-28 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-indigo-600/20 shadow-lg border border-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Pause className="h-5 w-5 fill-white" />
                  Pause
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => handleControlPomodoro("start")}
                  className="h-13 w-28 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-emerald-600/20 shadow-lg border border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5 fill-white" />
                  Start
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleControlPomodoro("skip")}
                className="h-11 w-11 rounded-xl bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Phase info helper card */}
            <div className="flex items-start gap-3.5 max-w-md rounded-xl bg-white/5 p-4 border border-white/5 text-xs text-zinc-400">
              <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Cara Kerja Pomodoro:</p>
                <p className="leading-relaxed">
                  Lakukan fokus selama 25 menit (Fokus Kerja), disusul 5 menit istirahat pendek. Setelah 4 sesi fokus berturut-turut, ambil istirahat panjang selama 15 menit. Anda dapat mengubah pengaturan durasi ini pada tab Pengaturan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-6 max-w-2xl">
            {/* Pomodoro Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Brain className="h-5 w-5 text-indigo-400" />
                  Durasi Pomodoro (Menit)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">Atur rentang waktu untuk masing-masing fase Pomodoro.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="focus-dur" className="text-xs font-semibold text-zinc-300">Fokus</Label>
                  <Input
                    id="focus-dur"
                    type="number"
                    min="1"
                    max="180"
                    value={pomSettings.focus}
                    onChange={(e) => setPomSettings({ ...pomSettings, focus: parseInt(e.target.value) || 0 })}
                    className="bg-black/30 border-white/5 text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="short-dur" className="text-xs font-semibold text-zinc-300">Istirahat Pendek</Label>
                  <Input
                    id="short-dur"
                    type="number"
                    min="1"
                    max="60"
                    value={pomSettings.short}
                    onChange={(e) => setPomSettings({ ...pomSettings, short: parseInt(e.target.value) || 0 })}
                    className="bg-black/30 border-white/5 text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="long-dur" className="text-xs font-semibold text-zinc-300">Istirahat Panjang</Label>
                  <Input
                    id="long-dur"
                    type="number"
                    min="1"
                    max="120"
                    value={pomSettings.long}
                    onChange={(e) => setPomSettings({ ...pomSettings, long: parseInt(e.target.value) || 0 })}
                    className="bg-black/30 border-white/5 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Healthy Reminders Settings Segment */}
            <Card className="border-white/5 bg-slate-900/30 glass-card">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                  <Bell className="h-5 w-5 text-indigo-400" />
                  Pengingat Kesehatan Berkala
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">Sesuaikan interval (menit) dan target harian untuk pengingat kesehatan.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {state.reminders.map((r) => {
                  const item = reminderSettings[r.id] || { interval: r.interval_minutes, target: r.progress_target };
                  return (
                    <div key={r.id} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-b border-white/5 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-300">
                          {getReminderIcon(r.id)}
                        </div>
                        <span className="text-xs font-bold text-white">{r.label}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`interval-${r.id}`} className="text-[10px] text-zinc-400">Interval (Menit)</Label>
                        <Input
                          id={`interval-${r.id}`}
                          type="number"
                          min="5"
                          max="360"
                          value={item.interval}
                          onChange={(e) => setReminderSettings({
                            ...reminderSettings,
                            [r.id]: { ...item, interval: parseInt(e.target.value) || 0 }
                          })}
                          className="bg-black/30 border-white/5 text-white h-9 text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`target-${r.id}`} className="text-[10px] text-zinc-400">Target Harian</Label>
                        <Input
                          id={`target-${r.id}`}
                          type="number"
                          min="1"
                          max="100"
                          value={item.target}
                          onChange={(e) => setReminderSettings({
                            ...reminderSettings,
                            [r.id]: { ...item, target: parseInt(e.target.value) || 0 }
                          })}
                          className="bg-black/30 border-white/5 text-white h-9 text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
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
                    const resettings: Record<string, { interval: number; target: number }> = {};
                    state.reminders.forEach((r) => {
                      resettings[r.id] = { interval: r.interval_minutes, target: r.progress_target };
                    });
                    setReminderSettings(resettings);
                  }
                }}
                className="h-11 px-6 bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveSettings}
                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-indigo-600/20 shadow-lg border border-indigo-500/20 rounded-xl"
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
