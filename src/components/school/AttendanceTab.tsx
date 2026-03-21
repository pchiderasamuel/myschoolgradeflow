import { useState, useMemo } from "react";
import { useApp } from "@/lib/school-store";
import { uid } from "@/lib/school-helpers";
import { ALL_CLASSES, ATT_STATUSES } from "@/lib/school-constants";
import { todayStr } from "@/lib/school-helpers";
import { CalendarDays, UserPlus, Search, Check } from "lucide-react";
import BottomSheet from "./BottomSheet";

export default function AttendanceTab() {
  const { state, dispatch, showToast } = useApp();
  const { attendance, classRolls } = state;

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [search, setSearch] = useState("");

  const students = useMemo(() => classRolls[selectedClass] || [], [classRolls, selectedClass]);

  const dayRecords = useMemo(() =>
    attendance.filter((a) => a.studentClass === selectedClass && a.date === selectedDate),
    [attendance, selectedClass, selectedDate]
  );

  const getStudentStatus = (name: string) => dayRecords.find((r) => r.studentName === name)?.status || "";

  const markAttendance = (studentName: string, status: string) => {
    const existing = dayRecords.find((r) => r.studentName === studentName);
    dispatch({
      type: "SAVE_ATTENDANCE",
      payload: {
        id: existing?.id || uid(),
        studentName,
        studentClass: selectedClass,
        date: selectedDate,
        status,
      },
    });
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
    const present = dayRecords.filter((r) => r.status === "present").length;
    const absent = dayRecords.filter((r) => r.status === "absent").length;
    const late = dayRecords.filter((r) => r.status === "late").length;
    return { present, absent, late, total: students.length };
  }, [dayRecords, students]);

  const filteredStudents = useMemo(() =>
    students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 space-y-3">
        <h2 className="text-lg font-bold text-foreground">Attendance</h2>

        {/* Class selector */}
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field">
          <option value="">Select class</option>
          {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {selectedClass && (
          <>
            {/* Date picker */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field" />
            </div>

            {/* Summary */}
            {summary && (
              <div className="flex gap-2">
                <span className="chip chip-success">{summary.present} Present</span>
                <span className="chip chip-danger">{summary.absent} Absent</span>
                <span className="chip chip-warning">{summary.late} Late</span>
                <span className="chip chip-muted">{summary.total} Total</span>
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
      <div className="flex-1 overflow-y-auto px-4 pb-24">
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
            {filteredStudents.map((s) => {
              const current = getStudentStatus(s.name);
              return (
                <div key={s.id} className="mobile-card p-3">
                  <p className="text-sm font-semibold text-foreground mb-2">{s.name}</p>
                  <div className="flex gap-2">
                    {ATT_STATUSES.map((st) => (
                      <button key={st.key} onClick={() => markAttendance(s.name, st.key)}
                        className={`chip flex-1 justify-center gap-1 transition-all ${current === st.key
                          ? st.color === "success" ? "chip-success" : st.color === "destructive" ? "chip-danger" : st.color === "warning" ? "chip-warning" : "chip-primary"
                          : "chip-muted"}`}>
                        {current === st.key && <Check className="w-3 h-3" />}
                        <span className="text-[10px]">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
