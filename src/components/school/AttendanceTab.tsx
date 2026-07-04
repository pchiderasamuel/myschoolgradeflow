import { useState, useMemo } from "react";
import { useApp } from "@/lib/school-store";
import { uid } from "@/lib/school-helpers";
import { ALL_CLASSES, ATT_STATUSES } from "@/lib/school-constants";
import { todayStr } from "@/lib/school-helpers";
import { CalendarDays, UserPlus, Search, Check, Save, ClipboardList } from "lucide-react";
import BottomSheet from "./BottomSheet";

export default function AttendanceTab() {
  const { state, dispatch, showToast } = useApp();
  const { attendance, classRolls } = state;

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [search, setSearch] = useState("");

  // Pending marks: { [studentName]: status } — unsaved local changes
  const [pending, setPending] = useState<Record<string, string>>({});

  const students = useMemo(() => classRolls[selectedClass] || [], [classRolls, selectedClass]);

  const dayRecords = useMemo(() =>
    attendance.filter((a) => a.studentClass === selectedClass && a.date === selectedDate),
    [attendance, selectedClass, selectedDate]
  );

  // Reset pending when class or date changes
  const handleClassChange = (cls: string) => {
    setSelectedClass(cls);
    setPending({});
    setSearch("");
  };
  const handleDateChange = (d: string) => {
    setSelectedDate(d);
    setPending({});
  };

  const getStudentStatus = (name: string) =>
    pending[name] ?? dayRecords.find((r) => r.studentName === name)?.status ?? "";

  const markOne = (studentName: string, status: string) => {
    setPending((p) => ({ ...p, [studentName]: status }));
  };

  // Mark All quick action
  const markAll = (status: string) => {
    const next: Record<string, string> = {};
    filteredStudents.forEach((s) => { next[s.name] = status; });
    setPending((p) => ({ ...p, ...next }));
  };

  // Save all pending marks to store
  const saveAll = () => {
    const toSave = Object.entries(pending);
    if (!toSave.length) return;
    toSave.forEach(([studentName, status]) => {
      const existing = dayRecords.find((r) => r.studentName === studentName);
      dispatch({
        type: "SAVE_ATTENDANCE",
        payload: {
          id: existing?.id || uid(),
          studentName,
          studentClass: selectedClass,
          date: selectedDate,
          status,
          note: existing?.note || "",
        },
      });
    });
    showToast(`${toSave.length} record${toSave.length !== 1 ? "s" : ""} saved`);
    setPending({});
  };

  const addStudent = () => {
    if (!addName.trim() || !selectedClass) return;
    const roll = classRolls[selectedClass] || [];
    dispatch({
      type: "SAVE_CLASS_ROLL",
      className: selectedClass,
      students: [...roll, { id: uid(), name: addName.trim() }],
    });
    showToast(`${addName.trim()} added to ${selectedClass}`);
    setAddName("");
    setShowAdd(false);
  };

  const summary = useMemo(() => {
    if (!students.length) return null;
    // Merge saved + pending for summary counts
    const merged: Record<string, string> = {};
    dayRecords.forEach((r) => { merged[r.studentName] = r.status; });
    Object.entries(pending).forEach(([n, s]) => { merged[n] = s; });
    const vals = Object.values(merged);
    return {
      present: vals.filter((s) => s === "present").length,
      absent: vals.filter((s) => s === "absent").length,
      late: vals.filter((s) => s === "late").length,
      excused: vals.filter((s) => s === "excused").length,
      total: students.length,
    };
  }, [dayRecords, students, pending]);

  const filteredStudents = useMemo(() =>
    students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  const pendingCount = Object.keys(pending).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Attendance tracker</h2>
            <p className="text-xs text-muted-foreground">Mark attendance quickly and keep a clear daily overview.</p>
          </div>
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ClipboardList className="w-4 h-4" />
          </div>
        </div>

        {/* Class selector */}
        <select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} className="input-field">
          <option value="">Select class</option>
          {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {selectedClass && (
          <>
            {/* Date picker */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)}
                max={todayStr()} className="input-field" />
            </div>

            {/* Summary chips */}
            {summary && (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Daily summary</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{selectedDate}</p>
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="chip chip-success">{summary.present} Present</span>
                  <span className="chip chip-danger">{summary.absent} Absent</span>
                  <span className="chip chip-warning">{summary.late} Late</span>
                  <span className="chip chip-muted">{summary.excused} Excused</span>
                  <span className="chip chip-muted">{summary.total} Total</span>
                </div>
              </div>
            )}

            {/* ── Mark All Quick Actions ─────────────────────────── */}
            {students.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Mark all as</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {ATT_STATUSES.map((st) => {
                    const variantCls =
                      st.color === "success" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300" :
                      st.color === "destructive" ? "bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300" :
                      st.color === "warning" ? "bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300" :
                      "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 active:bg-indigo-300";
                    return (
                      <button
                        key={st.key}
                        onClick={() => markAll(st.key)}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${variantCls}`}
                      >
                        <span>{st.icon}</span>
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            {students.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student..."
                  className="input-field pl-10" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Student list */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {!selectedClass ? (
          <div className="text-center py-16">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">Select a class</p>
            <p className="text-xs text-muted-foreground mt-1">Choose a class to take attendance</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-semibold">No students in this class</p>
            <p className="text-xs text-muted-foreground mt-1">Add students to start taking attendance</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 chip chip-primary">
              <UserPlus className="w-3 h-3" /> Add Student
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((s, i) => {
              const current = getStudentStatus(s.name);
              const isPending = pending[s.name] !== undefined;
              return (
                <div key={s.id} className={`mobile-card p-3 transition-colors ${isPending ? "border border-primary/30 bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                    <p className="text-sm font-semibold text-foreground flex-1 truncate">{s.name}</p>
                    {isPending && (
                      <span className="text-[9px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        unsaved
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 pl-7">
                    {ATT_STATUSES.map((st) => {
                      const active = current === st.key;
                      const activeCls =
                        st.color === "success" ? "bg-emerald-500 text-white" :
                        st.color === "destructive" ? "bg-red-500 text-white" :
                        st.color === "warning" ? "bg-amber-500 text-white" :
                        "bg-indigo-500 text-white";
                      return (
                        <button
                          key={st.key}
                          onClick={() => markOne(s.name, current === st.key ? "" : st.key)}
                          className={`chip flex-1 justify-center gap-1 transition-all text-[10px] ${active ? activeCls : "chip-muted"}`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Save bar (sticky bottom) ───────────────────────────────── */}
      {selectedClass && pendingCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <button
            onClick={saveAll}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-lg active:scale-[0.98] transition-transform"
          >
            <Save className="w-4 h-4" />
            Save {pendingCount} mark{pendingCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* FAB */}
      {selectedClass && (
        <button onClick={() => setShowAdd(true)} className="fab">
          <UserPlus className="w-6 h-6" />
        </button>
      )}

      {/* Add student sheet */}
      {showAdd && (
        <BottomSheet onClose={() => setShowAdd(false)}>
          <div className="p-5 space-y-4">
            <h3 className="text-lg font-bold">Add Student to {selectedClass}</h3>
            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Student full name"
              className="input-field" onKeyDown={(e) => e.key === "Enter" && addStudent()} />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground">Cancel</button>
              <button onClick={addStudent} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Add</button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
