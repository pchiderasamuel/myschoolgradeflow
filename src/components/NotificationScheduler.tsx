import { useState } from "react";
import { Bell, BellOff, Plus, Trash2, Coffee, Utensils, BookOpen, MessageSquare, BellRing, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useNotifications, ScheduledNotification, NotificationCategory } from "@/hooks/useNotifications";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORIES: { key: NotificationCategory; label: string; icon: React.ElementType; color: string; defaultTitle: string; defaultBody: string }[] = [
  { key: "message",  label: "Message",    icon: MessageSquare, color: "#3b82f6", defaultTitle: "New Message",       defaultBody: "You have a new school message." },
  { key: "break",    label: "Break Time", icon: Coffee,        color: "#f59e0b", defaultTitle: "☕ Break Time!",     defaultBody: "Time for a short break." },
  { key: "lunch",    label: "Lunch Time", icon: Utensils,      color: "#10b981", defaultTitle: "🍽️ Lunch Time!",    defaultBody: "Time for lunch — don't skip it!" },
  { key: "class",    label: "Next Class", icon: BookOpen,      color: "#8b5cf6", defaultTitle: "📚 Next Class",     defaultBody: "Your next class is starting soon." },
  { key: "custom",   label: "Custom",     icon: BellRing,      color: "#64748b", defaultTitle: "School Reminder",   defaultBody: "You have a scheduled reminder." },
];

interface FormState {
  category: NotificationCategory;
  title: string;
  body: string;
  time: string;
  days: number[];
}

const DEFAULT_FORM: FormState = {
  category: "break",
  title: "☕ Break Time!",
  body: "Time for a short break.",
  time: "10:30",
  days: [1, 2, 3, 4, 5], // Mon–Fri
};

function CategoryPill({ cat, selected, onSelect }: { cat: typeof CATEGORIES[0]; selected: boolean; onSelect: () => void }) {
  const Icon = cat.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all"
      style={{
        borderColor: selected ? cat.color : "#e2e8f0",
        background: selected ? `${cat.color}15` : "#f8fafc",
        color: selected ? cat.color : "#64748b",
      }}
    >
      <Icon size={18} />
      {cat.label}
    </button>
  );
}

function DayChip({ day, label, selected, onToggle }: { day: number; label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-9 h-9 rounded-full text-xs font-bold transition-all"
      style={{
        background: selected ? "#2563eb" : "#f1f5f9",
        color: selected ? "#fff" : "#64748b",
        border: selected ? "2px solid #2563eb" : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function ScheduleCard({ s, onToggle, onDelete, onTest }: {
  s: ScheduledNotification;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.key === s.category) ?? CATEGORIES[4];
  const Icon = cat.icon;
  const dayLabels = s.days.length === 0 ? "Every day" : s.days.map((d) => DAYS[d]).join(", ");

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border bg-white transition-all"
      style={{
        borderColor: s.enabled ? `${cat.color}30` : "#e2e8f0",
        opacity: s.enabled ? 1 : 0.6,
        boxShadow: s.enabled ? `0 2px 12px ${cat.color}12` : "none",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${cat.color}18`, color: cat.color }}
      >
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800 text-sm truncate">{s.title}</p>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{ background: `${cat.color}15`, color: cat.color }}
          >
            {s.time}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{dayLabels}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          title="Test now"
          onClick={onTest}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        >
          <BellRing size={14} />
        </button>
        <button
          type="button"
          title={s.enabled ? "Disable" : "Enable"}
          onClick={onToggle}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: s.enabled ? cat.color : "#94a3b8" }}
        >
          {s.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
        <button
          type="button"
          title="Delete"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationScheduler() {
  const { permission, schedules, requestPermission, addSchedule, removeSchedule, toggleSchedule, fireNow } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [testFlash, setTestFlash] = useState<string | null>(null);

  const handleCategorySelect = (key: NotificationCategory) => {
    const cat = CATEGORIES.find((c) => c.key === key)!;
    setForm((f) => ({ ...f, category: key, title: cat.defaultTitle, body: cat.defaultBody }));
  };

  const handleToggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSchedule({ ...form, enabled: true });
    setForm(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleTest = (s: ScheduledNotification) => {
    fireNow(s);
    setTestFlash(s.id);
    setTimeout(() => setTestFlash(null), 1500);
  };

  const grantedAndScheduled = permission === "granted" && schedules.length > 0;
  const enabled = schedules.filter((s) => s.enabled).length;

  return (
    <div style={{ fontFamily: "'Inter', 'DM Sans', sans-serif", maxWidth: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
          >
            <Bell size={18} color="#fff" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Notification Alerts</h2>
            <p className="text-xs text-slate-400">
              {grantedAndScheduled ? `${enabled} of ${schedules.length} active` : "Schedule your school alerts"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: showForm ? "#64748b" : "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: showForm ? "none" : "0 2px 8px rgba(37,99,235,.3)" }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "New Alert"}
        </button>
      </div>

      {/* Permission banner */}
      {permission !== "granted" && (
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-xl mb-4"
          style={{ background: permission === "denied" ? "#fef2f2" : "#eff6ff", border: `1px solid ${permission === "denied" ? "#fecaca" : "#bfdbfe"}` }}
        >
          <div className="flex items-center gap-2">
            {permission === "denied" ? <BellOff size={16} color="#ef4444" /> : <Bell size={16} color="#2563eb" />}
            <div>
              <p className="text-sm font-semibold" style={{ color: permission === "denied" ? "#dc2626" : "#1d4ed8" }}>
                {permission === "denied" ? "Notifications Blocked" : "Enable Notifications"}
              </p>
              <p className="text-xs" style={{ color: permission === "denied" ? "#ef4444" : "#3b82f6" }}>
                {permission === "denied"
                  ? "Allow notifications in your browser settings to receive alerts."
                  : "Allow notifications to receive break-time, lunch, and class reminders on this device."}
              </p>
            </div>
          </div>
          {permission !== "denied" && (
            <button
              type="button"
              onClick={requestPermission}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "#2563eb" }}
            >
              Allow
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-2xl mb-4"
          style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Alert Type</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {CATEGORIES.map((cat) => (
              <CategoryPill key={cat.key} cat={cat} selected={form.category === cat.key} onSelect={() => handleCategorySelect(cat.key)} />
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
              <input
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#e2e8f0", outline: "none", background: "#fff" }}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={60}
                placeholder="Alert title"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
              <input
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#e2e8f0", outline: "none", background: "#fff" }}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
                maxLength={120}
                placeholder="Notification message"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
              <input
                type="time"
                className="px-3 py-2 rounded-lg border text-sm font-mono"
                style={{ borderColor: "#e2e8f0", outline: "none", background: "#fff" }}
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Days (empty = every day)</label>
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => (
                  <DayChip key={i} day={i} label={d.slice(0, 2)} selected={form.days.includes(i)} onToggle={() => handleToggleDay(i)} />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 2px 8px rgba(37,99,235,.3)" }}
          >
            <Check size={16} />
            Save Alert
          </button>
        </form>
      )}

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="text-center py-10">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#f1f5f9" }}
          >
            <Bell size={24} color="#94a3b8" />
          </div>
          <p className="text-sm font-semibold text-slate-500">No alerts scheduled</p>
          <p className="text-xs text-slate-400 mt-1">Click "New Alert" to set up your first notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} style={{ position: "relative" }}>
              {testFlash === s.id && (
                <div
                  className="absolute inset-0 rounded-xl flex items-center justify-center z-10 text-xs font-bold text-white"
                  style={{ background: "rgba(37,99,235,.85)", borderRadius: 12 }}
                >
                  <BellRing size={14} className="mr-1" /> Sent!
                </div>
              )}
              <ScheduleCard
                s={s}
                onToggle={() => toggleSchedule(s.id)}
                onDelete={() => removeSchedule(s.id)}
                onTest={() => handleTest(s)}
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-300 text-center mt-4">
        Alerts fire on this device while the app is open. Keep the tab active for scheduled notifications.
      </p>
    </div>
  );
}
