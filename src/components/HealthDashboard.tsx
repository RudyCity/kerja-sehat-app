import { Droplet, Activity, Eye, Heart, Sparkles, Check, Clock, Zap, Target, CheckCircle2, AlertCircle } from "lucide-react";
import { translations, Language } from "./i18n";

/* ── Types ───────────────────────────────────────────────────── */
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
  sessions_completed: number;
  state: string;
}

interface HealthDashboardProps {
  reminders: Reminder[];
  pomodoro: Pomodoro;
  onToggle: (id: string, enabled: boolean) => void;
  onLog: (id: string) => void;
  lang: Language;
}

/* ── Per-reminder config ─────────────────────────────────────── */
const REMINDER_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;       // hex for inline style
  colorClass: string;  // tailwind text color
  bgClass: string;
  borderClass: string;
  ringClass: string;
  gradientFrom: string;
}> = {
  water:   { icon: Droplet,   color: "#38bdf8", colorClass: "text-sky-400",     bgClass: "bg-sky-500/10",     borderClass: "border-sky-500/20",     ringClass: "ring-sky-500/20",     gradientFrom: "from-sky-950/40" },
  stretch: { icon: Activity,  color: "#34d399", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20", ringClass: "ring-emerald-500/20", gradientFrom: "from-emerald-950/40" },
  eye:     { icon: Eye,       color: "#fbbf24", colorClass: "text-amber-400",   bgClass: "bg-amber-500/10",   borderClass: "border-amber-500/20",   ringClass: "ring-amber-500/20",   gradientFrom: "from-amber-950/40"   },
  posture: { icon: Heart,     color: "#fb7185", colorClass: "text-rose-400",    bgClass: "bg-rose-500/10",    borderClass: "border-rose-500/20",    ringClass: "ring-rose-500/20",    gradientFrom: "from-rose-950/40"    },
  custom:  { icon: Sparkles,  color: "#818cf8", colorClass: "text-indigo-400", bgClass: "bg-indigo-500/10", borderClass: "border-indigo-500/20", ringClass: "ring-indigo-500/20", gradientFrom: "from-indigo-950/40"  },
};

const getLocalizedUnit = (id: string, lang: Language) => {
  const t = translations[lang];
  if (id === "water") return t.glass_unit;
  return t.times_unit;
};

const DEFAULT_CONFIG = REMINDER_CONFIG.custom;

/* ── Countdown helpers ───────────────────────────────────────── */
function getCountdownSeconds(reminder: Reminder): number {
  if (!reminder.is_enabled || !reminder.next_trigger) return 0;
  return Math.max(0, reminder.next_trigger - Math.floor(Date.now() / 1000));
}

function formatCountdown(seconds: number, lang: Language): string {
  const t = translations[lang];
  if (seconds <= 0) return t.now;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return t.hours_remaining(h, m);
  if (m === 0) return t.less_than_minute;
  return t.minutes_remaining(m);
}

/* ── Mini ring for countdown urgency ────────────────────────── */
function UrgencyDot({ seconds, color }: { seconds: number; color: string }) {
  const urgent = seconds > 0 && seconds < 120;
  const soon   = seconds > 0 && seconds < 300;
  if (!urgent && !soon) return null;
  return (
    <span className="relative flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/* ── Stat Chip ───────────────────────────────────────────────── */
function StatChip({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 min-w-[110px]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-2xl font-black leading-none" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-zinc-600 mt-0.5">{sub}</span>}
    </div>
  );
}

/* ── Reminder Card ───────────────────────────────────────────── */
function ReminderCard({
  reminder,
  onToggle,
  onLog,
  lang,
}: {
  reminder: Reminder;
  onToggle: (id: string, enabled: boolean) => void;
  onLog: (id: string) => void;
  lang: Language;
}) {
  const t = translations[lang];
  const cfg = REMINDER_CONFIG[reminder.id] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;
  const pct = reminder.progress_target > 0
    ? Math.min(100, Math.round((reminder.progress_count / reminder.progress_target) * 100))
    : 0;
  const done = reminder.progress_count >= reminder.progress_target;
  const cdSec = getCountdownSeconds(reminder);
  const cdLabel = reminder.is_enabled ? formatCountdown(cdSec, lang) : t.disabled;
  const urgent = cdSec > 0 && cdSec < 120;

  return (
    <div
      className={`
        group relative flex flex-col gap-0 overflow-hidden rounded-2xl border
        transition-all duration-300
        ${reminder.is_enabled
          ? `${cfg.borderClass} bg-gradient-to-b ${cfg.gradientFrom} to-slate-950/80`
          : "border-white/5 bg-white/[0.02]"
        }
        ${done ? "ring-1 ring-offset-0 " + cfg.ringClass : ""}
      `}
    >
      {/* Done ribbon */}
      {done && (
        <div className={`absolute top-0 right-0 flex items-center gap-1 rounded-bl-xl px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${cfg.bgClass} ${cfg.colorClass}`}>
          <CheckCircle2 className="h-3 w-3" />
          {t.completed}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cfg.borderClass} ${cfg.bgClass}`}>
            <Icon className={`h-5 w-5 ${cfg.colorClass}`} />
            {urgent && reminder.is_enabled && (
              <span className="absolute -top-1 -right-1">
                <UrgencyDot seconds={cdSec} color={cfg.color} />
              </span>
            )}
          </div>

          {/* Title + meta */}
          <div>
            <p className={`text-sm font-bold leading-tight ${reminder.is_enabled ? "text-white" : "text-zinc-500"}`}>
              {reminder.label}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {t.every} {reminder.interval_minutes} {lang === "en" ? "mins" : "mnt"} · {t.target} {reminder.progress_target}×
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(reminder.id, !reminder.is_enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 focus:outline-none mt-0.5 ${
            reminder.is_enabled ? "shadow-md" : "bg-zinc-800"
          }`}
          style={reminder.is_enabled ? { backgroundColor: cfg.color, boxShadow: `0 0 10px ${cfg.color}50` } : {}}
          title={reminder.is_enabled ? (lang === "en" ? "Deactivate" : "Nonaktifkan") : (lang === "en" ? "Activate" : "Aktifkan")}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
              reminder.is_enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* ── Message ────────────────────────────────────────── */}
      <div className="px-5 pb-4">
        <p className={`text-xs leading-relaxed ${reminder.is_enabled ? "text-zinc-400" : "text-zinc-600"}`}>
          {reminder.message}
        </p>
      </div>

      {/* ── Progress bar ───────────────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Progress</span>
          <span className={`text-[10px] font-bold ${cfg.colorClass}`}>
            {reminder.progress_count} / {reminder.progress_target} {getLocalizedUnit(reminder.id, lang)}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: cfg.color, boxShadow: pct > 0 ? `0 0 8px ${cfg.color}60` : "none" }}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
        {/* Countdown */}
        <div className="flex items-center gap-2">
          {urgent && reminder.is_enabled
            ? <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            : <Clock className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          }
          <span className={`text-[11px] font-semibold ${urgent && reminder.is_enabled ? "text-amber-400" : "text-zinc-500"}`}>
            {cdLabel}
          </span>
        </div>

        {/* Log button */}
        <button
          disabled={!reminder.is_enabled || done}
          onClick={() => onLog(reminder.id)}
          className={`
            flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold
            border transition-all duration-200 active:scale-95
            disabled:pointer-events-none disabled:opacity-30
            ${done
              ? `${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`
              : `bg-white/5 border-white/10 text-zinc-300 hover:${cfg.bgClass} hover:${cfg.colorClass} hover:${cfg.borderClass}`
            }
          `}
        >
          {done
            ? <><CheckCircle2 className="h-3.5 w-3.5" /> {t.completed}</>
            : <><Check className="h-3.5 w-3.5" /> {t.record}</>
          }
        </button>
      </div>
    </div>
  );
}

/* ── Overall progress ring ───────────────────────────────────── */
function OverallRing({ pct }: { pct: number }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);
  return (
    <svg width="96" height="96" className="-rotate-90">
      <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
      <circle
        cx="48" cy="48" r={R} fill="none"
        stroke="url(#overallGrad)" strokeWidth="6"
        strokeDasharray={C} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <defs>
        <linearGradient id="overallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export function HealthDashboard({ reminders, pomodoro, onToggle, onLog, lang }: HealthDashboardProps) {
  const t = translations[lang];
  const totalCompleted = reminders.reduce((a, r) => a + r.progress_count, 0);
  const totalTarget    = reminders.reduce((a, r) => a + r.progress_target, 0);
  const overallPct     = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;
  const activeCount    = reminders.filter(r => r.is_enabled).length;
  const doneCount      = reminders.filter(r => r.progress_count >= r.progress_target).length;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero Section ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/10 bg-gradient-to-br from-indigo-950/50 via-purple-950/20 to-slate-950/60 p-6">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-4 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          {/* Text */}
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/15 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                {t.daily_target}
              </span>
              {doneCount === reminders.length && reminders.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" /> {t.all_completed}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-white mb-1.5 tracking-tight">
              {t.health_activities_today}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
              {t.hero_desc}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Donut ring */}
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <OverallRing pct={overallPct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-white leading-none">{overallPct}%</span>
                <span className="text-[9px] text-zinc-500 mt-0.5 font-medium">{lang === "en" ? "completed" : "selesai"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <StatChip label={t.active_reminders} value={activeCount} sub={`${t.out_of} ${reminders.length} ${t.total}`} color="#818cf8" />
              <StatChip label={t.focus_session} value={pomodoro.sessions_completed} sub={t.today_chip} color="#34d399" />
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="relative mt-5 pt-4 border-t border-white/5">
          <div className="flex justify-between text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
            <span>{t.overall_progress}</span>
            <span className="text-indigo-400">{totalCompleted} / {totalTarget} {t.activities}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPct}%`,
                background: "linear-gradient(90deg, #6366f1, #a855f7)",
                boxShadow: overallPct > 0 ? "0 0 12px #6366f160" : "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Reminder Cards ────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-white">{t.health_reminders}</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5">{t.log_activity_desc}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-zinc-300">{doneCount}/{reminders.length} {t.completed}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reminders.map((r) => (
            <ReminderCard key={r.id} reminder={r} onToggle={onToggle} onLog={onLog} lang={lang} />
          ))}
        </div>
      </div>

      {/* ── Tips strip ────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-zinc-300 mb-1">{t.tips_title}</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {t.tips_desc}
          </p>
        </div>
      </div>

    </div>
  );
}
