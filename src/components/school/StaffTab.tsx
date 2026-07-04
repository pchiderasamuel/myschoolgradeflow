import { useState, useMemo, useRef, useCallback } from "react";
import { useApp } from "@/lib/school-store";
import { uid } from "@/lib/school-helpers";
import { ROLES, PERMS_META, ALL_CLASSES, CURRICULUM } from "@/lib/school-constants";
import type { StaffMember } from "@/lib/school-store";
import {
  UserPlus, Search, Shield, Eye, EyeOff, Check, X,
  AlertTriangle, ChevronRight, ShieldCheck, UserX, RotateCcw,
} from "lucide-react";
import BottomSheet from "./BottomSheet";

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: "identity",    icon: "👤", label: "Identity",    desc: "Name, role & PIN" },
  { id: "status",      icon: "🔑", label: "Status",      desc: "Account access level" },
  { id: "permissions", icon: "🛡️", label: "Permissions", desc: "Feature access" },
  { id: "classes",     icon: "📚", label: "Classes",     desc: "Assigned classes" },
] as const;

type StepId = typeof STEPS[number]["id"];

const blankForm = () => ({
  name: "", role: "Teacher", pin: "", status: "active" as const,
  assignedClasses: [] as string[],
  permissions: { scoreEntry: true, viewReports: true, printReports: false, manageRecords: false },
});

// ─── Inner stepped form ────────────────────────────────────────────────────────
function StaffForm({
  editStaff,
  onSave,
  onClose,
}: {
  editStaff: StaffMember | null;
  onSave: (payload: StaffMember) => void;
  onClose: () => void;
}) {
  const initialForm = editStaff
    ? {
        name: editStaff.name,
        role: editStaff.role,
        pin: "",
        status: editStaff.status,
        assignedClasses: [...editStaff.assignedClasses],
        permissions: {
          scoreEntry: editStaff.permissions.scoreEntry ?? true,
          viewReports: editStaff.permissions.viewReports ?? true,
          printReports: editStaff.permissions.printReports ?? false,
          manageRecords: editStaff.permissions.manageRecords ?? false,
        },
      }
    : blankForm();

  const [form, setForm] = useState(initialForm);
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState<StepId>("identity");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const setF = useCallback(<K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }, []);

  const toggleClass = (cls: string) =>
    setF("assignedClasses", form.assignedClasses.includes(cls)
      ? form.assignedClasses.filter((c) => c !== cls)
      : [...form.assignedClasses, cls]);

  const togglePerm = (key: string) =>
    setF("permissions", { ...form.permissions, [key]: !form.permissions[key as keyof typeof form.permissions] });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!editStaff && form.pin.length < 4) e.pin = "PIN must be at least 4 digits";
    if (editStaff && form.pin.length > 0 && form.pin.length < 4) e.pin = "PIN must be at least 4 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) { setActiveStep("identity"); return; }
    onSave({
      id: editStaff?.id || uid(),
      name: form.name.trim(),
      role: form.role,
      pin: form.pin || editStaff?.pin || "",
      status: form.status,
      assignedClasses: form.assignedClasses,
      permissions: form.permissions,
      signature: editStaff?.signature,
      createdAt: editStaff?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const scrollToStep = (id: StepId) => {
    setActiveStep(id);
    const el = sectionRefs.current[id];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const top = scrollRef.current.scrollTop + 50;
    let found: StepId = "identity";
    STEPS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el && el.offsetTop <= top) found = s.id;
    });
    setActiveStep(found);
  };

  const statusCls = {
    active: "border-emerald-400 bg-emerald-50 text-emerald-700",
    restricted: "border-amber-400 bg-amber-50 text-amber-700",
    revoked: "border-red-400 bg-red-50 text-red-700",
    resigned: "border-slate-400 bg-slate-100 text-slate-700",
  };
  const inactiveCls = "border-border bg-card text-muted-foreground hover:border-slate-300";
  const initials = form.name.trim()
    ? form.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const avatarBg = form.status === "active" ? "bg-primary" : form.status === "restricted" ? "bg-warning" : "bg-muted";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {editStaff ? "Edit Staff" : "Add Staff"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {editStaff ? "Update access and permissions" : "Fill all sections then save"}
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Step nav tabs (mobile horizontal scroll) ── */}
      <div className="px-5 pb-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                activeStep === s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable form body ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 pb-4 space-y-7"
      >
        {/* ── Step 1: Identity ── */}
        <section ref={(el) => { sectionRefs.current.identity = el; }} className="space-y-3 pt-1">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span>👤</span>
            <p className="text-xs font-bold uppercase text-foreground tracking-wide">Identity</p>
          </div>

          {/* Avatar preview */}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${avatarBg} flex items-center justify-center text-primary-foreground font-bold text-base flex-shrink-0`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{form.name || <span className="text-muted-foreground italic">No name</span>}</p>
              <p className="text-xs text-muted-foreground">{form.role}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Full Name *</label>
            <input value={form.name} onChange={(e) => setF("name", e.target.value)}
              placeholder="e.g. Mrs. Amaka Obi" className={`input-field ${errors.name ? "border-destructive" : ""}`} />
            {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Role</label>
              <select value={form.role} onChange={(e) => setF("role", e.target.value)} className="input-field">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                {editStaff ? "New PIN (optional)" : "Access PIN *"}
              </label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={form.pin}
                  maxLength={8}
                  placeholder={editStaff ? "Leave blank to keep" : "Min 4 digits"}
                  onChange={(e) => setF("pin", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className={`input-field pr-10 text-center tracking-widest font-bold ${errors.pin ? "border-destructive" : ""}`}
                />
                <button type="button" onClick={() => setShowPin((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.pin && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.pin}</p>}
              {form.pin.length >= 4 && <p className="text-xs text-emerald-600 font-semibold">✓ {form.pin.length}-digit PIN set</p>}
            </div>
          </div>
        </section>

        {/* ── Step 2: Status ── */}
        <section ref={(el) => { sectionRefs.current.status = el; }} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span>🔑</span>
            <p className="text-xs font-bold uppercase text-foreground tracking-wide">Account Status</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["active", "restricted", "revoked", "resigned"] as const).map((st) => (
              <button key={st} type="button" onClick={() => setF("status", st)}
                className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border-2 transition-all capitalize ${
                  form.status === st ? statusCls[st] : inactiveCls
                }`}>
                {st === "active" ? "✓ Active" : st === "restricted" ? "⚠ Restricted" : "✗ Revoked"}
              </button>
            ))}
          </div>
          <div className={`rounded-xl p-3 text-xs border ${
            form.status === "active" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
            form.status === "restricted" ? "bg-amber-50 border-amber-100 text-amber-700" :
            "bg-red-50 border-red-100 text-red-700"
          }`}>
            {form.status === "active" && "Full access to all permitted features."}
            {form.status === "restricted" && "Can log in but with limited feature access."}
            {form.status === "revoked" && "Account disabled — staff cannot log in."}
            {form.status === "resigned" && "Access removed because the staff member is no longer active."}
          </div>
        </section>

        {/* ── Step 3: Permissions ── */}
        <section ref={(el) => { sectionRefs.current.permissions = el; }} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span>🛡️</span>
            <p className="text-xs font-bold uppercase text-foreground tracking-wide">Feature Permissions</p>
          </div>
          {PERMS_META.map(({ key, label, desc }) => (
            <button key={key} type="button" onClick={() => togglePerm(key)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                form.permissions[key as keyof typeof form.permissions]
                  ? "border-primary/30 bg-primary/5"
                  : "border-border opacity-70 hover:opacity-90"
              }`}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                form.permissions[key as keyof typeof form.permissions]
                  ? "bg-primary border-primary"
                  : "border-border bg-card"
              }`}>
                {form.permissions[key as keyof typeof form.permissions] && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex-shrink-0 ${
                form.permissions[key as keyof typeof form.permissions]
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {form.permissions[key as keyof typeof form.permissions] ? "On" : "Off"}
              </span>
            </button>
          ))}
        </section>

        {/* ── Step 4: Classes ── */}
        <section ref={(el) => { sectionRefs.current.classes = el; }} className="space-y-3 pb-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <span>📚</span>
              <p className="text-xs font-bold uppercase text-foreground tracking-wide">Assigned Classes</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {form.assignedClasses.length || "All"}
              </span>
            </div>
            <button type="button"
              onClick={() => setF("assignedClasses", form.assignedClasses.length === ALL_CLASSES.length ? [] : [...ALL_CLASSES])}
              className="text-xs font-bold text-primary hover:underline">
              {form.assignedClasses.length === ALL_CLASSES.length ? "Clear all" : "Select all"}
            </button>
          </div>
          {Object.entries(CURRICULUM).map(([cat, data]) => (
            <div key={cat} className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {data.classes.map((cls) => (
                  <button key={cls} type="button" onClick={() => toggleClass(cls)}
                    className={`chip text-xs transition-all ${
                      form.assignedClasses.includes(cls) ? "chip-primary" : "chip-muted"
                    }`}>
                    {form.assignedClasses.includes(cls) && <Check className="w-3 h-3" />}
                    {cls}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {form.assignedClasses.length === 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">No classes selected — staff can access all classes</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Footer actions ── */}
      <div className="px-5 py-4 border-t border-border bg-card flex gap-3 flex-shrink-0">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground active:scale-[0.97] transition-transform">
          Cancel
        </button>
        <button onClick={handleSave}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-[0.97] transition-transform">
          {editStaff ? "Save Changes" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

// ─── Main StaffTab ─────────────────────────────────────────────────────────────
export default function StaffTab() {
  const { state, dispatch, showToast } = useApp();
  const { staffList } = state;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);

  const startEdit = (s: StaffMember) => { setEditStaff(s); setShowForm(true); };
  const startAdd = () => { setEditStaff(null); setShowForm(true); };

  const handleSave = (payload: StaffMember) => {
    dispatch({ type: "SAVE_STAFF", payload });
    showToast(editStaff ? "Staff updated" : "Staff added");
    setShowForm(false);
  };

  const counts = useMemo(() => ({
    All: staffList.length,
    Active: staffList.filter((s) => s.status === "active").length,
    Restricted: staffList.filter((s) => s.status === "restricted").length,
    Revoked: staffList.filter((s) => s.status === "revoked").length,
    Resigned: staffList.filter((s) => s.status === "resigned").length,
  }), [staffList]);

  const filtered = useMemo(() => staffList.filter((s) => {
    const mf = filter === "All" || s.status === filter.toLowerCase();
    const ms = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return mf && ms;
  }), [staffList, filter, search]);

  const statusColor = (s: string) =>
    s === "active" ? "chip-success" : s === "restricted" ? "chip-warning" : s === "resigned" ? "chip-muted" : "chip-danger";

  const handleQuickStatus = (staff: StaffMember, nextStatus: StaffMember["status"]) => {
    dispatch({ type: "SET_STAFF_STATUS", id: staff.id, status: nextStatus });
    showToast(`${staff.name} marked as ${nextStatus === "resigned" ? "resigned" : nextStatus === "revoked" ? "revoked" : "active"}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Staff</h2>
            <p className="text-xs text-muted-foreground">{counts.Active} active · {counts.Revoked} revoked</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Admin control center</p>
              <h3 className="text-sm font-semibold text-foreground">Manage staff access when someone resigns or leaves</h3>
            </div>
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/80 p-2">
              <p className="text-lg font-bold text-foreground">{counts.Active}</p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="rounded-xl bg-white/80 p-2">
              <p className="text-lg font-bold text-foreground">{counts.Revoked + counts.Resigned}</p>
              <p className="text-[10px] text-muted-foreground">Revoked</p>
            </div>
            <div className="rounded-xl bg-white/80 p-2">
              <p className="text-lg font-bold text-foreground">{counts.Restricted}</p>
              <p className="text-[10px] text-muted-foreground">Restricted</p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(["All", "Active", "Restricted", "Revoked", "Resigned"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`chip flex-shrink-0 ${filter === f ? "chip-primary" : "chip-muted"}`}>
              {f} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..."
            className="input-field pl-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">No staff found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const permsOn = PERMS_META.filter((p) => s.permissions[p.key]);
              return (
                <div key={s.id} className="mobile-card p-4">
                  <div className="flex items-center gap-3" onClick={() => startEdit(s)}>
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0 ${
                      s.status === "active" ? "bg-primary" : s.status === "restricted" ? "bg-warning" : s.status === "resigned" ? "bg-slate-500" : "bg-muted"
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.role}</p>
                      {permsOn.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {permsOn.slice(0, 3).map((p) => (
                            <span key={p.key} className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                              {p.label.split(" ")[0]}
                            </span>
                          ))}
                          {permsOn.length > 3 && (
                            <span className="text-[9px] font-bold text-muted-foreground">+{permsOn.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`chip text-[10px] ${statusColor(s.status)}`}>{s.status}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <p className="text-[11px] text-muted-foreground">
                      {s.status === "resigned" || s.status === "revoked"
                        ? "Access removed"
                        : s.status === "restricted"
                          ? "Limited access"
                          : "Full access"}
                    </p>
                    <div className="flex gap-2">
                      {(s.status === "active" || s.status === "restricted") ? (
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatus(s, "resigned"); }} className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">
                          <UserX className="w-3 h-3" /> Revoke
                        </button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatus(s, "active"); }} className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={startAdd} className="fab"><UserPlus className="w-6 h-6" /></button>

      {/* ── Stepped Staff Form Sheet ── */}
      {showForm && (
        <BottomSheet onClose={() => setShowForm(false)}>
          <StaffForm
            editStaff={editStaff}
            onSave={handleSave}
            onClose={() => setShowForm(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}
