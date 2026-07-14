import { useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, SkipForward, Sparkles, Brain, Coffee, Zap } from "lucide-react";
import { translations, Language } from "./i18n";

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

interface PomodoroTimerProps {
  pomodoro: Pomodoro;
  localTime: number;
  onControl: (action: "start" | "pause" | "reset" | "skip") => void;
  lang: Language;
}

/* ── Config per mode ─────────────────────────────────────────── */
const MODE_CONFIG = {
  focus: {
    label: "Fokus Kerja",
    sublabel: "Tetap fokus, hasilkan yang terbaik",
    icon: Brain,
    color: "#6366f1",        // indigo-500
    colorMuted: "#6366f120",
    colorText: "text-indigo-400",
    colorBorder: "border-indigo-500/30",
    colorBg: "bg-indigo-500/10",
    colorRing: "#6366f1",
    colorGlow: "shadow-indigo-500/20",
    gradient: "from-indigo-950/60 via-slate-950/80 to-slate-950",
    badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  },
  shortbreak: {
    label: "Istirahat Pendek",
    sublabel: "Tarik napas, regangkan tubuh sejenak",
    icon: Coffee,
    color: "#10b981",        // emerald-500
    colorMuted: "#10b98120",
    colorText: "text-emerald-400",
    colorBorder: "border-emerald-500/30",
    colorBg: "bg-emerald-500/10",
    colorRing: "#10b981",
    colorGlow: "shadow-emerald-500/20",
    gradient: "from-emerald-950/60 via-slate-950/80 to-slate-950",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  },
  longbreak: {
    label: "Istirahat Panjang",
    sublabel: "Kamu sudah bekerja keras, istirahat dulu!",
    icon: Zap,
    color: "#06b6d4",        // cyan-500
    colorMuted: "#06b6d420",
    colorText: "text-cyan-400",
    colorBorder: "border-cyan-500/30",
    colorBg: "bg-cyan-500/10",
    colorRing: "#06b6d4",
    colorGlow: "shadow-cyan-500/20",
    gradient: "from-cyan-950/60 via-slate-950/80 to-slate-950",
    badgeBg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  },
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return { m, s };
}

/* ── SVG Ring ────────────────────────────────────────────────── */
function ProgressRing({
  progress,
  color,
  isRunning,
}: {
  progress: number;
  color: string;
  isRunning: boolean;
}) {
  const SIZE = 320;
  const STROKE = 6;
  const R = (SIZE - STROKE * 2) / 2 - 8;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <svg
      width={SIZE}
      height={SIZE}
      className="absolute inset-0 -rotate-90"
      style={{ filter: isRunning ? `drop-shadow(0 0 8px ${color}60)` : "none" }}
    >
      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={STROKE}
      />
      {/* Second track (decorative dots) */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R + 14}
        fill="none"
        stroke="rgba(255,255,255,0.02)"
        strokeWidth={1}
        strokeDasharray="4 8"
      />
      {/* Progress arc */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
      />
    </svg>
  );
}

/* ── Session Dots ────────────────────────────────────────────── */
function SessionDots({ completed }: { completed: number }) {
  const dots = Array.from({ length: 4 });
  return (
    <div className="flex items-center gap-2">
      {dots.map((_, i) => (
        <div
          key={i}
          className={`
            h-1.5 rounded-full transition-all duration-500
            ${i < (completed % 4)
              ? "w-5 bg-indigo-400"
              : "w-1.5 bg-white/10"
            }
          `}
        />
      ))}
    </div>
  );
}

/* ── Control Button ──────────────────────────────────────────── */
function CtrlBtn({
  onClick,
  children,
  size = "md",
  variant = "ghost",
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "primary" | "danger";
  title?: string;
}) {
  const sizeClass = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }[size];

  const variantClass = {
    ghost: "bg-white/5 border border-white/8 text-zinc-400 hover:bg-white/10 hover:text-white",
    primary: "bg-indigo-600 border border-indigo-500/30 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25",
    danger: "bg-white/5 border border-white/8 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30",
  }[variant];

  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        ${sizeClass} ${variantClass}
        flex items-center justify-center rounded-2xl
        transition-all duration-200 active:scale-95
      `}
    >
      {children}
    </button>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export function PomodoroTimer({ pomodoro, localTime, onControl, lang }: PomodoroTimerProps) {
  const t = translations[lang];
  const cfg = MODE_CONFIG[pomodoro.mode];
  const ModeIcon = cfg.icon;
  const progress = pomodoro.current_duration > 0
    ? localTime / pomodoro.current_duration
    : 0;
  const { m, s } = formatTime(localTime);
  const isRunning = pomodoro.state === "running";
  const isPaused = pomodoro.state === "paused";

  const modeLabels = {
    focus: {
      label: t.focus_work,
      sublabel: t.focus_sublabel,
    },
    shortbreak: {
      label: t.short_break,
      sublabel: t.short_break_sublabel,
    },
    longbreak: {
      label: t.long_break,
      sublabel: t.long_break_sublabel,
    },
  };
  const currentModeInfo = modeLabels[pomodoro.mode];

  // Animate glow ring when running
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    if (isRunning) {
      el.style.opacity = "1";
    } else {
      el.style.opacity = "0";
    }
  }, [isRunning]);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto select-none">

      {/* ── Mode Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/5 p-1.5">
        {(["focus", "shortbreak", "longbreak"] as const).map((m) => {
          const c = MODE_CONFIG[m];
          const active = pomodoro.mode === m;
          return (
            <div
              key={m}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                transition-all duration-300
                ${active
                  ? `${c.colorBg} ${c.colorText} ${c.colorBorder} border`
                  : "text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              <c.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{modeLabels[m].label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Timer Ring + Content ───────────────────────────────── */}
      <div className="relative flex h-80 w-80 items-center justify-center">

        {/* Ambient glow behind ring */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-1000"
          style={{
            background: `radial-gradient(circle, ${cfg.color}18 0%, transparent 70%)`,
            opacity: 0,
          }}
        />

        {/* Outer subtle ring background */}
        <div className="absolute inset-0 rounded-full border border-white/5 bg-slate-950/40 backdrop-blur-sm" />

        {/* SVG progress ring */}
        <ProgressRing progress={progress} color={cfg.color} isRunning={isRunning} />

        {/* Inner content */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          {/* Mode badge */}
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${cfg.badgeBg}`}>
            <ModeIcon className="h-3 w-3" />
            {currentModeInfo.label}
          </div>

          {/* Timer digits */}
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span
              className="text-7xl font-black leading-none tracking-tight text-white"
              style={{ textShadow: isRunning ? `0 0 40px ${cfg.color}60` : "none", transition: "text-shadow 0.5s ease" }}
            >
              {m}
            </span>
            <span className={`text-4xl font-black ${isPaused ? "animate-pulse" : ""} ${cfg.colorText}`}>:</span>
            <span
              className="text-7xl font-black leading-none tracking-tight text-white"
              style={{ textShadow: isRunning ? `0 0 40px ${cfg.color}60` : "none", transition: "text-shadow 0.5s ease" }}
            >
              {s}
            </span>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 border border-white/5 px-3 py-1">
            {isRunning && (
              <span className="relative flex h-1.5 w-1.5">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75`}
                  style={{ backgroundColor: cfg.color }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color }} />
              </span>
            )}
            <span className="text-[10px] font-medium text-zinc-400">
              {isRunning ? t.running : isPaused ? t.paused : t.ready_start}
            </span>
          </div>
        </div>
      </div>

      {/* ── Session progress dots ──────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <SessionDots completed={pomodoro.sessions_completed} />
        <p className="text-[10px] text-zinc-500">
          {lang === "en"
            ? `${pomodoro.sessions_completed % 4} / 4 sessions · Total ${pomodoro.sessions_completed} completed`
            : `${pomodoro.sessions_completed % 4} / 4 sesi · Total ${pomodoro.sessions_completed} selesai`}
        </p>
      </div>

      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <CtrlBtn onClick={() => onControl("reset")} size="md" variant="ghost" title="Reset">
          <RotateCcw className="h-5 w-5" />
        </CtrlBtn>

        {isRunning ? (
          <CtrlBtn onClick={() => onControl("pause")} size="lg" variant="primary" title="Pause">
            <Pause className="h-6 w-6 fill-white stroke-none" />
          </CtrlBtn>
        ) : (
          <button
            onClick={() => onControl("start")}
            title="Start"
            className={`
              relative h-16 w-16 flex items-center justify-center rounded-2xl
              text-white font-bold transition-all duration-200 active:scale-95
              shadow-lg ${cfg.colorGlow}
            `}
            style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)` }}
          >
            {/* Shine overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/15 to-transparent" />
            <Play className="relative h-6 w-6 fill-white stroke-none translate-x-0.5" />
          </button>
        )}

        <CtrlBtn onClick={() => onControl("skip")} size="md" variant="ghost" title={lang === "en" ? "Skip phase" : "Skip fase"}>
          <SkipForward className="h-5 w-5" />
        </CtrlBtn>
      </div>

      {/* ── Info strip ────────────────────────────────────────── */}
      <div className={`
        w-full rounded-2xl border p-4 text-xs text-zinc-400 leading-relaxed
        bg-white/[0.03] border-white/5
      `}>
        <div className="flex items-start gap-3">
          <Sparkles className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.colorText}`} />
          <div>
            <p className="font-semibold text-zinc-300 mb-1">{currentModeInfo.sublabel}</p>
            <p>
              {pomodoro.mode === "focus"
                ? t.focus_time_info(pomodoro.focus_duration, pomodoro.short_break_duration, pomodoro.long_break_duration)
                : pomodoro.mode === "shortbreak"
                ? t.short_break_info
                : t.long_break_info}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
