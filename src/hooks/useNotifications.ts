/**
 * useNotifications — Browser Notification API wrapper.
 * Handles permission, scheduling, and firing of notifications.
 * Schedules are stored in localStorage and fired via setTimeout.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationCategory = "message" | "break" | "lunch" | "class" | "custom";

export interface ScheduledNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  time: string; // "HH:MM" 24h format
  days: number[]; // 0=Sun,1=Mon,...,6=Sat (empty = every day)
  enabled: boolean;
  createdAt: number;
}

export type NotificationPermission = "default" | "granted" | "denied";

const STORAGE_KEY = "schoolapp_notification_schedules";
const ICON_MAP: Record<NotificationCategory, string> = {
  message: "💬",
  break:   "☕",
  lunch:   "🍽️",
  class:   "📚",
  custom:  "🔔",
};

function loadSchedules(): ScheduledNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSchedules(schedules: ScheduledNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

function msUntilTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // tomorrow
  return target.getTime() - now.getTime();
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "default")
  );
  const [schedules, setSchedules] = useState<ScheduledNotification[]>(loadSchedules);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Request permission ───────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // ── Fire a one-off notification ──────────────────────────────────────────
  const fireNow = useCallback((schedule: ScheduledNotification) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const emoji = ICON_MAP[schedule.category];
    new Notification(`${emoji} ${schedule.title}`, {
      body: schedule.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: schedule.id,
    });
  }, []);

  // ── Schedule a notification ──────────────────────────────────────────────
  const scheduleOne = useCallback(
    (s: ScheduledNotification) => {
      if (!s.enabled || Notification.permission !== "granted") return;

      // Check if today is a scheduled day
      const today = new Date().getDay();
      if (s.days.length > 0 && !s.days.includes(today)) return;

      const delay = msUntilTime(s.time);
      const timer = setTimeout(() => {
        fireNow(s);
        // Re-schedule for next occurrence (daily or next valid weekday)
        scheduleOne(s);
      }, delay);

      timersRef.current.set(s.id, timer);
    },
    [fireNow]
  );

  // ── Cancel a specific timer ──────────────────────────────────────────────
  const cancelTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // ── Re-schedule all enabled notifications ───────────────────────────────
  const rescheduleAll = useCallback(
    (list: ScheduledNotification[]) => {
      // Clear all existing timers first
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      list.filter((s) => s.enabled).forEach(scheduleOne);
    },
    [scheduleOne]
  );

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addSchedule = useCallback(
    (s: Omit<ScheduledNotification, "id" | "createdAt">) => {
      const newSchedule: ScheduledNotification = {
        ...s,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setSchedules((prev) => {
        const updated = [...prev, newSchedule];
        saveSchedules(updated);
        rescheduleAll(updated);
        return updated;
      });
      return newSchedule;
    },
    [rescheduleAll]
  );

  const updateSchedule = useCallback(
    (id: string, patch: Partial<ScheduledNotification>) => {
      cancelTimer(id);
      setSchedules((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
        saveSchedules(updated);
        rescheduleAll(updated);
        return updated;
      });
    },
    [cancelTimer, rescheduleAll]
  );

  const removeSchedule = useCallback(
    (id: string) => {
      cancelTimer(id);
      setSchedules((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        saveSchedules(updated);
        return updated;
      });
    },
    [cancelTimer]
  );

  const toggleSchedule = useCallback(
    (id: string) => {
      setSchedules((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        );
        saveSchedules(updated);
        rescheduleAll(updated);
        return updated;
      });
    },
    [rescheduleAll]
  );

  // ── Boot: schedule all on mount ──────────────────────────────────────────
  useEffect(() => {
    if (permission === "granted") {
      rescheduleAll(schedules);
    }
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  return {
    permission,
    schedules,
    requestPermission,
    fireNow,
    addSchedule,
    updateSchedule,
    removeSchedule,
    toggleSchedule,
  };
}
