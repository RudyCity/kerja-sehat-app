import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";

// Helper to check if running inside Tauri webview
export const isTauri = () => typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

// Mock State for browser mode
const mockState: any = {
  reminders: [
    {
      id: "water",
      label: "Minum Air",
      interval_minutes: 30,
      next_trigger: Math.floor(Date.now() / 1000) + 30 * 60,
      is_enabled: true,
      progress_count: 2,
      progress_target: 8,
      message: "Jangan lupa minum segelas air untuk menjaga hidrasi tubuh Anda.",
    },
    {
      id: "stretch",
      label: "Peregangan",
      interval_minutes: 60,
      next_trigger: Math.floor(Date.now() / 1000) + 60 * 60,
      is_enabled: true,
      progress_count: 1,
      progress_target: 4,
      message: "Berdiri dan lakukan peregangan ringan selama 2 menit.",
    },
    {
      id: "eye",
      label: "Istirahat Mata",
      interval_minutes: 20,
      next_trigger: Math.floor(Date.now() / 1000) + 20 * 60,
      is_enabled: true,
      progress_count: 5,
      progress_target: 12,
      message: "Fokuskan mata Anda ke objek yang berjarak 20 kaki (6 meter) selama 20 detik.",
    },
    {
      id: "posture",
      label: "Perbaiki Postur",
      interval_minutes: 40,
      next_trigger: Math.floor(Date.now() / 1000) + 40 * 60,
      is_enabled: true,
      progress_count: 3,
      progress_target: 6,
      message: "Tegakkan punggung Anda, posisikan bahu rileks, dan letakkan kaki rata di lantai.",
    },
  ],
  pomodoro: {
    mode: "focus",
    state: "idle",
    focus_duration: 25,
    short_break_duration: 5,
    long_break_duration: 15,
    current_duration: 25 * 60,
    time_left: 25 * 60,
    target_timestamp: null,
    sessions_completed: 0,
  },
  last_reset_date: new Date().toISOString().split("T")[0],
  language: "id",
  sound_enabled: true,
};

const listeners = new Set<(event: { payload: any }) => void>();
const eventListeners = new Map<string, Set<(event: { payload: any }) => void>>();

// Simulate tick in browser mode
if (!isTauri()) {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);

    // 1. Handle Pomodoro countdowns
    if (mockState.pomodoro.state === "running") {
      if (mockState.pomodoro.time_left > 0) {
        mockState.pomodoro.time_left -= 1;
      } else {
        // Switch modes on completion
        let nextMode = "";
        if (mockState.pomodoro.mode === "focus") {
          mockState.pomodoro.sessions_completed += 1;
          if (mockState.pomodoro.sessions_completed % 4 === 0) {
            mockState.pomodoro.mode = "longbreak";
            mockState.pomodoro.current_duration = mockState.pomodoro.long_break_duration * 60;
            mockState.pomodoro.time_left = mockState.pomodoro.long_break_duration * 60;
            nextMode = "Time for a Long Break!";
          } else {
            mockState.pomodoro.mode = "shortbreak";
            mockState.pomodoro.current_duration = mockState.pomodoro.short_break_duration * 60;
            mockState.pomodoro.time_left = mockState.pomodoro.short_break_duration * 60;
            nextMode = "Time for a Short Break!";
          }
        } else {
          mockState.pomodoro.mode = "focus";
          mockState.pomodoro.current_duration = mockState.pomodoro.focus_duration * 60;
          mockState.pomodoro.time_left = mockState.pomodoro.focus_duration * 60;
          nextMode = "Time to Focus Again!";
        }
        mockState.pomodoro.state = "idle";
        
        // Trigger mock event for Pomodoro completion
        const pListeners = eventListeners.get("pomodoro-triggered");
        if (pListeners) {
          pListeners.forEach((cb) => cb({ payload: nextMode }));
        }
      }
    }

    // 2. Handle health reminders countdowns in mock (trigger when time comes)
    mockState.reminders.forEach((r: any) => {
      if (r.is_enabled && r.next_trigger) {
        if (now >= r.next_trigger) {
          r.next_trigger = now + r.interval_minutes * 60;
          // Trigger mock reminder notification
          const rListeners = eventListeners.get("reminder-triggered");
          if (rListeners) {
            rListeners.forEach((cb) => cb({ payload: r.id }));
          }
        }
      }
    });

    // Always send state ticks every second to keep clocks/countdowns up-to-date in browser UI
    listeners.forEach((cb) => cb({ payload: { ...mockState } }));
  }, 1000);
}

export async function invoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }

  console.log(`[Mock Tauri] Invoking command: ${cmd}`, args);

  switch (cmd) {
    case "get_state":
      return { ...mockState } as T;

    case "toggle_reminder": {
      const { id, enabled } = args;
      mockState.reminders = mockState.reminders.map((r: any) =>
        r.id === id
          ? {
              ...r,
              is_enabled: enabled,
              next_trigger: enabled ? Math.floor(Date.now() / 1000) + r.interval_minutes * 60 : null,
            }
          : r
      );
      return { ...mockState } as T;
    }

    case "log_reminder_progress": {
      const { id } = args;
      mockState.reminders = mockState.reminders.map((r: any) =>
        r.id === id
          ? {
              ...r,
              progress_count: Math.min(r.progress_target, r.progress_count + 1),
              next_trigger: r.is_enabled ? Math.floor(Date.now() / 1000) + r.interval_minutes * 60 : null,
            }
          : r
      );
      return { ...mockState } as T;
    }

    case "control_pomodoro": {
      const { action } = args;
      if (action === "start") {
        mockState.pomodoro.state = "running";
      } else if (action === "pause") {
        mockState.pomodoro.state = "paused";
      } else if (action === "reset") {
        mockState.pomodoro.state = "idle";
        mockState.pomodoro.time_left = mockState.pomodoro.current_duration;
      } else if (action === "skip") {
        mockState.pomodoro.state = "idle";
        if (mockState.pomodoro.mode === "focus") {
          mockState.pomodoro.mode = "shortbreak";
          mockState.pomodoro.current_duration = mockState.pomodoro.short_break_duration * 60;
          mockState.pomodoro.time_left = mockState.pomodoro.short_break_duration * 60;
        } else {
          mockState.pomodoro.mode = "focus";
          mockState.pomodoro.current_duration = mockState.pomodoro.focus_duration * 60;
          mockState.pomodoro.time_left = mockState.pomodoro.focus_duration * 60;
        }
      }
      
      // Immediately notify active listeners of state transition
      const updated = { ...mockState };
      setTimeout(() => {
        listeners.forEach((cb) => cb({ payload: updated }));
      }, 0);
      
      return updated as T;
    }

    case "update_pomodoro_settings": {
      const { focus, short, long } = args;
      mockState.pomodoro.focus_duration = focus;
      mockState.pomodoro.short_break_duration = short;
      mockState.pomodoro.long_break_duration = long;

      if (mockState.pomodoro.mode === "focus") {
        mockState.pomodoro.current_duration = focus * 60;
      } else if (mockState.pomodoro.mode === "shortbreak") {
        mockState.pomodoro.current_duration = short * 60;
      } else if (mockState.pomodoro.mode === "longbreak") {
        mockState.pomodoro.current_duration = long * 60;
      }
      mockState.pomodoro.time_left = mockState.pomodoro.current_duration;
      return { ...mockState } as T;
    }

    case "update_reminder_settings": {
      const { id, label, message, intervalMinutes, target } = args;
      mockState.reminders = mockState.reminders.map((r: any) =>
        r.id === id
          ? {
              ...r,
              label,
              message,
              interval_minutes: intervalMinutes,
              progress_target: target,
              next_trigger: r.is_enabled ? Math.floor(Date.now() / 1000) + intervalMinutes * 60 : null,
            }
          : r
      );
      return { ...mockState } as T;
    }

    case "toggle_sound": {
      const { enabled } = args;
      mockState.sound_enabled = enabled;
      return { ...mockState } as T;
    }

    case "set_language": {
      const { lang } = args;
      mockState.language = lang;
      return { ...mockState } as T;
    }

    case "add_custom_reminder": {
      const { label, intervalMinutes, target, message } = args;
      const now = Math.floor(Date.now() / 1000);
      const newRem = {
        id: `custom_${now}`,
        label,
        interval_minutes: intervalMinutes,
        next_trigger: now + intervalMinutes * 60,
        is_enabled: true,
        progress_count: 0,
        progress_target: target,
        message,
      };
      mockState.reminders.push(newRem);
      return { ...mockState } as T;
    }

    case "delete_reminder": {
      const { id } = args;
      mockState.reminders = mockState.reminders.filter((r: any) => r.id !== id);
      return { ...mockState } as T;
    }

    default:
      throw new Error(`Unhandled mock command: ${cmd}`);
  }
}

export async function listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> {
  if (isTauri()) {
    return tauriListen<T>(event, handler);
  }

  console.log(`[Mock Tauri] Registering listener for event: ${event}`);
  if (event === "state-tick") {
    listeners.add(handler);
  } else {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(handler);
  }

  return () => {
    if (event === "state-tick") {
      listeners.delete(handler);
    } else {
      const set = eventListeners.get(event);
      if (set) {
        set.delete(handler);
      }
    }
  };
}
