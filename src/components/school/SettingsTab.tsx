import { useState } from "react";
import { useApp } from "@/lib/school-store";
import type { EmailJSConfig } from "@/lib/school-store";
import { TERMS } from "@/lib/school-constants";
import { Settings, Save, GraduationCap, Eye, EyeOff, Clock, Mail } from "lucide-react";
import { fmtTimestamp } from "@/lib/school-helpers";

export default function SettingsTab() {
  const { state, dispatch, showToast } = useApp();
  const { schoolSettings, logs, adminPin } = state;

  const [draft, setDraft] = useState({ ...schoolSettings });
  const [pinDraft, setPinDraft] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailJSConfig>(schoolSettings.emailjs || { serviceId: "", templateId: "", publicKey: "" });
  const [section, setSection] = useState<"school" | "pin" | "logs" | "email">("school");

  const saveSettings = () => {
    dispatch({ type: "SET_SCHOOL_SETTINGS", payload: draft });
    showToast("Settings saved!");
  };

  const savePin = () => {
    if (pinDraft.length < 4) { showToast("PIN must be at least 4 digits", "error"); return; }
    dispatch({ type: "SET_ADMIN_PIN", pin: pinDraft });
    showToast("Admin PIN updated!");
    setPinDraft("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h2 className="text-lg font-bold text-foreground">Settings</h2>
      </div>

      {/* Section tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 flex-wrap">
          {([["school", "School"], ["pin", "Security"], ["email", "Email"], ["logs", "Activity"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)}
              className={`chip ${section === k ? "chip-primary" : "chip-muted"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {section === "school" && (
          <div className="space-y-4">
            <div className="mobile-card p-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <p className="text-sm font-bold">School Information</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">School Name</label>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Motto</label>
                  <input value={draft.motto} onChange={(e) => setDraft((d) => ({ ...d, motto: e.target.value }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Session</label>
                  <input value={draft.session} onChange={(e) => setDraft((d) => ({ ...d, session: e.target.value }))}
                    className="input-field" placeholder="e.g. 2024/2025" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Term</label>
                  <select value={draft.term} onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
                    className="input-field">
                    {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Resumption Date</label>
                  <input value={draft.resumptionDate} onChange={(e) => setDraft((d) => ({ ...d, resumptionDate: e.target.value }))}
                    className="input-field" />
                </div>
              </div>

              <button onClick={saveSettings}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
                <Save className="w-4 h-4" /> Save Settings
              </button>
            </div>
          </div>
        )}

        {section === "pin" && (
          <div className="mobile-card p-4 space-y-4">
            <p className="text-sm font-bold">Admin PIN</p>
            <p className="text-xs text-muted-foreground">Current PIN has {adminPin.length} digits. Set a new PIN below.</p>
            <div className="relative">
              <input type={showPin ? "text" : "password"} value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="New PIN (min 4 digits)" className="input-field text-center tracking-widest pr-10" />
              <button onClick={() => setShowPin((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={savePin}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-[0.97] transition-transform">
              Update PIN
            </button>
          </div>
        )}

        {section === "logs" && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold">No activity yet</p>
              </div>
            ) : (
              logs.slice(0, 30).map((log) => {
                const { date, time } = fmtTimestamp(log.ts);
                return (
                  <div key={log.id} className="mobile-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="chip chip-muted text-[10px]">{log.action}</span>
                      <span className="text-[10px] text-muted-foreground">{date} {time}</span>
                    </div>
                    <p className="text-sm font-medium">{log.student}</p>
                    {log.detail && <p className="text-xs text-muted-foreground">{log.detail}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
