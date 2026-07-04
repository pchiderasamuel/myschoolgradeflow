import { useState, useMemo } from "react";
import { useApp } from "@/lib/school-store";
import { uid } from "@/lib/school-helpers";
import { getGrade } from "@/lib/school-helpers";
import { ALL_CLASSES, getSubjectsForClass } from "@/lib/school-constants";
import { PlusCircle, Search, Trash2, RotateCcw, Users } from "lucide-react";
import BottomSheet from "./BottomSheet";

export default function ScoresTab() {
  const { state, dispatch, showToast } = useApp();
  const { entries, bin, schoolSettings, classRolls } = state;

  const [view, setView] = useState<"list" | "add" | "bin">("list");
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");

  // Add form
  const [form, setForm] = useState({
    studentName: "", studentClass: "", subject: "", ca1: "", ca2: "", ca3: "", exam: "",
  });

  const subjects = useMemo(() => getSubjectsForClass(form.studentClass), [form.studentClass]);

  // ── Datalist: names from class roll for the selected class ──
  const classSuggestions = useMemo(() => {
    if (!form.studentClass) return [];
    const fromRoll = (classRolls[form.studentClass] || []).map((s) => s.name);
    const fromEntries = entries
      .filter((e) => e.studentClass === form.studentClass)
      .map((e) => e.studentName);
    return [...new Set([...fromRoll, ...fromEntries])].sort();
  }, [classRolls, entries, form.studentClass]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const ms = !search || e.studentName.toLowerCase().includes(search.toLowerCase()) || e.subject.toLowerCase().includes(search.toLowerCase());
      const mc = !filterClass || e.studentClass === filterClass;
      return ms && mc;
    });
  }, [entries, search, filterClass]);

  const handleAdd = () => {
    const ca1 = Number(form.ca1) || 0;
    const ca2 = Number(form.ca2) || 0;
    const ca3 = Number(form.ca3) || 0;
    const exam = Number(form.exam) || 0;
    const total = ca1 + ca2 + ca3 + exam;

    if (!form.studentName.trim() || !form.studentClass || !form.subject) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (total > 100) {
      showToast("Total cannot exceed 100", "error");
      return;
    }

    dispatch({
      type: "ADD_ENTRY",
      payload: {
        id: uid(),
        studentName: form.studentName.trim(),
        studentClass: form.studentClass,
        subject: form.subject,
        ca1, ca2, ca3, exam, total,
        term: schoolSettings.term,
        session: schoolSettings.session,
        enteredBy: "Admin",
        createdAt: new Date().toISOString(),
      },
    });
    showToast("Score entry saved!");
    // Keep class selected, clear student/scores for quick re-entry
    setForm((f) => ({ ...f, studentName: "", subject: "", ca1: "", ca2: "", ca3: "", exam: "" }));
  };

  const handleClassChange = (cls: string) => {
    setForm((f) => ({ ...f, studentClass: cls, studentName: "", subject: "" }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Scores</h2>
            <p className="text-xs text-muted-foreground">{entries.length} records · {bin.length} in bin</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("bin")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or subject..."
            className="input-field pl-10" />
        </div>

        {/* Class filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setFilterClass("")} className={`chip flex-shrink-0 ${!filterClass ? "chip-primary" : "chip-muted"}`}>All</button>
          {ALL_CLASSES.map((c) => (
            <button key={c} onClick={() => setFilterClass(c)} className={`chip flex-shrink-0 ${filterClass === c ? "chip-primary" : "chip-muted"}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-semibold text-foreground">No scores found</p>
            <p className="text-xs text-muted-foreground mt-1">Add a score entry to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => {
              const g = getGrade(e.total);
              return (
                <div key={e.id} className="mobile-card p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className={`text-sm font-bold ${g.color}`}>{g.grade}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{e.studentName}</p>
                    <p className="text-xs text-muted-foreground">{e.subject} · {e.studentClass} · {e.total}%</p>
                  </div>
                  <button onClick={() => { dispatch({ type: "DELETE_ENTRY", id: e.id }); showToast("Moved to bin"); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setView("add")} className="fab">
        <PlusCircle className="w-6 h-6" />
      </button>

      {/* ── Add Sheet ─────────────────────────────────────────────── */}
      {view === "add" && (
        <BottomSheet onClose={() => setView("list")}>
          <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">New Score Entry</h3>

            {/* Class first so datalist can populate */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Class</label>
              <select value={form.studentClass} onChange={(e) => handleClassChange(e.target.value)}
                className="input-field">
                <option value="">Select class</option>
                {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Student name with datalist autocomplete */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Student Name</label>
              <input
                list="score-student-suggestions"
                value={form.studentName}
                onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                placeholder="Type or pick from roll…"
                className="input-field"
              />
              <datalist id="score-student-suggestions">
                {classSuggestions.map((n) => <option key={n} value={n} />)}
              </datalist>
              {classSuggestions.length > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {classSuggestions.length} student{classSuggestions.length !== 1 ? "s" : ""} on roll — tap name to autofill
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Subject</label>
              <select value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="input-field" disabled={!form.studentClass}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Score inputs */}
            <div className="grid grid-cols-4 gap-2">
              {(["ca1", "ca2", "ca3", "exam"] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">
                    {k === "exam" ? "Exam" : k.toUpperCase()}
                  </label>
                  <input type="number" value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="input-field text-center" placeholder="0"
                    min={0} max={k === "exam" ? 60 : 20} />
                </div>
              ))}
            </div>

            {/* Live total preview */}
            {(Number(form.ca1) + Number(form.ca2) + Number(form.ca3) + Number(form.exam)) > 0 && (() => {
              const total = Number(form.ca1) + Number(form.ca2) + Number(form.ca3) + Number(form.exam);
              const g = getGrade(total);
              return (
                <div className="mobile-card p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.bg} ${g.color}`}>{g.grade} — {g.remark}</span>
                    <span className="text-lg font-bold text-foreground">{total}%</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setView("list")}
                className="flex-1 py-3 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground active:scale-[0.97] transition-transform">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-[0.97] transition-transform">
                Save Entry
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Bin Sheet */}
      {view === "bin" && (
        <BottomSheet onClose={() => setView("list")}>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Recycle Bin ({bin.length})</h3>
            {bin.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Bin is empty</p>
            ) : (
              <div className="space-y-2">
                {bin.map((e) => (
                  <div key={e.id} className="mobile-card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{e.studentName}</p>
                      <p className="text-xs text-muted-foreground">{e.subject} · {e.total}%</p>
                    </div>
                    <button onClick={() => { dispatch({ type: "RESTORE_ENTRY", id: e.id }); showToast("Entry restored"); }}
                      className="chip chip-success">
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
