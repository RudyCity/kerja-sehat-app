import { useState, useRef, useEffect } from "react";
import { Pencil, Check } from "lucide-react";

interface EditableNumberFieldProps {
  id?: string;
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  accentColor?: string; // tailwind text color class e.g. "text-indigo-400"
  lang?: "id" | "en";
}

/**
 * Displays a numeric value as a stylish preview tile.
 * Click the tile (or pencil icon) to switch to an inline number input.
 * Confirm with Enter key or by clicking away (blur).
 */
export function EditableNumberField({
  id,
  label,
  value,
  unit = "menit",
  min = 1,
  max = 999,
  onChange,
  accentColor = "text-indigo-400",
  lang = "id",
}: EditableNumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  // Auto-focus & select all when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setDraft(String(clamped));
    } else {
      setDraft(String(value)); // revert on invalid
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(String(value));
      setEditing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>

      {editing ? (
        /* ── Edit Mode ─────────────────────────────── */
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            id={id}
            type="number"
            min={min}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={`
              w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10
              px-4 py-3 pr-10 text-2xl font-bold text-white
              outline-none ring-2 ring-indigo-500/30
              transition-all duration-150
              [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
              [&::-webkit-outer-spin-button]:appearance-none
            `}
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); commit(); }}
            className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-white shadow transition hover:bg-indigo-400"
            title={lang === "en" ? "Confirm" : "Konfirmasi"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* ── Preview Mode ───────────────────────────── */
        <button
          id={id}
          onClick={() => setEditing(true)}
          className={`
            group relative flex w-full items-end justify-between gap-2
            rounded-xl border border-white/5 bg-white/5
            px-4 py-3
            transition-all duration-200
            hover:border-indigo-500/30 hover:bg-indigo-500/10
          `}
          title={lang === "en" ? "Click to edit" : "Klik untuk edit"}
        >
          {/* Value display */}
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-black leading-none tracking-tight ${accentColor}`}>
              {value}
            </span>
            <span className="text-[10px] font-medium text-zinc-500">{unit}</span>
          </div>

          {/* Pencil icon */}
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-zinc-500 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-white group-hover:bg-white/10">
            <Pencil className="h-3 w-3" />
          </span>
        </button>
      )}
    </div>
  );
}
