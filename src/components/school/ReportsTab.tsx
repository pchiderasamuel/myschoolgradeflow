import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/school-store";
import { getGrade } from "@/lib/school-helpers";
import { ALL_CLASSES } from "@/lib/school-constants";
import { FileText, Search, Printer, AlertCircle, ImagePlus, PenTool, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function ReportsTab() {
  const { state, dispatch, showToast } = useApp();
  const { entries, schoolSettings, staffList } = state;
  const { user, schoolId, profile } = useAuth();

  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customization, setCustomization] = useState(schoolSettings.reportCustomization || {
    signerName: "Class Teacher",
    signerRole: "Class Teacher",
    signatureType: "typed" as const,
    signatureValue: "",
    stampUrl: "",
    showDate: true,
    dateLabel: "Date",
  });
  
  const [dbSignature, setDbSignature] = useState<string | null>(null);
  const [dbSignatureType, setDbSignatureType] = useState<"typed" | "drawn" | null>(null);

  useEffect(() => {
    setCustomization(schoolSettings.reportCustomization || {
      signerName: "Class Teacher",
      signerRole: "Class Teacher",
      signatureType: "typed",
      signatureValue: "",
      stampUrl: "",
      showDate: true,
      dateLabel: "Date",
    });
  }, [schoolSettings.reportCustomization]);

  useEffect(() => {
    if (!user || !schoolId) return;
    const fetchSig = async () => {
      const { data } = await supabase
        .from("staff_settings")
        .select("signature, signature_type")
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();
      if (data) {
        setDbSignature(data.signature);
        setDbSignatureType(data.signature_type as "typed" | "drawn");
      }
    };
    fetchSig();
  }, [user, schoolId]);

  const students = useMemo(() => {
    if (!selectedClass) return [];
    const classEntries = entries.filter((e) => e.studentClass === selectedClass);
    const names = [...new Set(classEntries.map((e) => e.studentName))];
    return names.map((name) => {
      const studentEntries = classEntries.filter((e) => e.studentName === name);
      const avg = studentEntries.length
        ? Math.round(studentEntries.reduce((s, e) => s + e.total, 0) / studentEntries.length)
        : 0;
      return { name, entries: studentEntries, avg, grade: getGrade(avg) };
    }).sort((a, b) => b.avg - a.avg);
  }, [entries, selectedClass]);

  const filtered = useMemo(() =>
    students.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const studentDetail = useMemo(() => {
    if (!selectedStudent) return null;
    return students.find((s) => s.name === selectedStudent) || null;
  }, [selectedStudent, students]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setCustomization((prev) => ({ ...prev, stampUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const saveCustomization = () => {
    dispatch({
      type: "SET_SCHOOL_SETTINGS",
      payload: {
        reportCustomization: customization,
      },
    });
    showToast("Report sheet updated", "success");
    setShowCustomizer(false);
  };

  const reportSignatureValue = customization.signatureValue || dbSignature || studentDetail?.entries[0]?.enteredBy ? "" : "";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Reports</h2>
            <p className="text-xs text-muted-foreground">Customize report sheets with name, signature, stamp, and date.</p>
          </div>
          <button onClick={() => setShowCustomizer((v) => !v)} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
            {showCustomizer ? "Hide" : "Customize"}
          </button>
        </div>

        {showCustomizer && (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Report sheet customization</p>
            </div>
            <div className="grid gap-3">
              <input value={customization.signerName} onChange={(e) => setCustomization((prev) => ({ ...prev, signerName: e.target.value }))} placeholder="Signer name" className="input-field" />
              <input value={customization.signerRole} onChange={(e) => setCustomization((prev) => ({ ...prev, signerRole: e.target.value }))} placeholder="Role" className="input-field" />
              <div className="flex gap-2">
                <label className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground">
                  <input type="radio" checked={customization.signatureType === "typed"} onChange={() => setCustomization((prev) => ({ ...prev, signatureType: "typed" }))} className="mr-2" /> Typed name
                </label>
                <label className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground">
                  <input type="radio" checked={customization.signatureType === "drawn"} onChange={() => setCustomization((prev) => ({ ...prev, signatureType: "drawn" }))} className="mr-2" /> Drawn sign
                </label>
              </div>
              <input value={customization.signatureValue || ""} onChange={(e) => setCustomization((prev) => ({ ...prev, signatureValue: e.target.value }))} placeholder="Signature text or base64" className="input-field" />
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-white px-3 py-3 text-sm font-semibold text-primary">
                <ImagePlus className="w-4 h-4" />
                Upload school stamp
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              {customization.stampUrl && <img src={customization.stampUrl} alt="Stamp preview" className="h-16 w-auto object-contain rounded-lg border border-border bg-white" />}
              <label className="flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground">
                <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Show date on report</span>
                <input type="checkbox" checked={customization.showDate} onChange={(e) => setCustomization((prev) => ({ ...prev, showDate: e.target.checked }))} />
              </label>
              <input value={customization.dateLabel} onChange={(e) => setCustomization((prev) => ({ ...prev, dateLabel: e.target.value }))} placeholder="Date label" className="input-field" />
            </div>
            <button onClick={saveCustomization} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save report settings</button>
          </div>
        )}

        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}
          className="input-field">
          <option value="">Select class</option>
          {ALL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {selectedClass && students.length > 0 && !selectedStudent && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student..."
              className="input-field pl-10" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {!selectedClass ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">Select a class to view reports</p>
          </div>
        ) : selectedStudent && studentDetail ? (
          /* Student detail report */
          <div className="space-y-4">
            <button onClick={() => setSelectedStudent(null)} className="text-xs font-bold text-primary">← Back to list</button>

            <div className="mobile-card p-5">
              <div className="text-center mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{schoolSettings.name}</p>
                <h3 className="text-lg font-bold mt-1">{studentDetail.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedClass} · {schoolSettings.term} · {schoolSettings.session}</p>
              </div>

              <div className="flex justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{studentDetail.avg}%</p>
                  <p className="text-xs text-muted-foreground">Average</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${studentDetail.grade.color}`}>{studentDetail.grade.grade}</p>
                  <p className="text-xs text-muted-foreground">Grade</p>
                </div>
              </div>

              {/* Subject breakdown */}
              <div className="space-y-2">
                <p className="section-title">Subject Scores</p>
                {studentDetail.entries.map((e) => {
                  const g = getGrade(e.total);
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.subject}</p>
                        <p className="text-xs text-muted-foreground">CA: {e.ca1}+{e.ca2}+{e.ca3} | Exam: {e.exam}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-sm font-bold ${g.color}`}>{e.total}%</p>
                        <p className="text-xs text-muted-foreground">{g.grade}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Staff Signature Section */}
              {(() => {
                const staffMember = studentDetail.entries[0]?.enteredBy ? staffList.find((s) => s.name === studentDetail.entries[0].enteredBy) : null;
                const signatureToUse = customization.signatureValue || dbSignature || staffMember?.signature || "";
                const staffName = customization.signerName || (profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (staffMember?.name || "Staff Member"));
                const staffRole = customization.signerRole || (profile?.role || staffMember?.role || "Teacher");
                const showSignature = customization.signatureType === "typed" ? (signatureToUse ? <span className="font-caveat text-4xl text-slate-800">{signatureToUse}</span> : <span className="font-caveat text-4xl text-slate-800">{staffName}</span>) : (signatureToUse ? <img src={signatureToUse} alt="Signature" className="h-16 object-contain" /> : <div className="h-16 w-40 rounded border border-dashed border-border" />);
                
                return (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Staff Authorization</p>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        {showSignature}
                        <div className="mt-2">
                          <p className="text-xs font-semibold">{staffName}</p>
                          <p className="text-xs text-muted-foreground">{staffRole}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {customization.stampUrl && <img src={customization.stampUrl} alt="Stamp" className="h-12 w-auto object-contain mb-2" />}
                        {customization.showDate && <p className="text-xs text-muted-foreground">{customization.dateLabel}: {new Date().toLocaleDateString()}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button onClick={() => window.print()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
              <Printer className="w-4 h-4" /> Print Report
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-semibold">No score records for this class</p>
            <p className="text-xs text-muted-foreground mt-1">Add score entries first</p>
          </div>
        ) : (
          /* Student list */
          <div className="space-y-2">
            {filtered.map((s, i) => (
              <div key={s.name} onClick={() => setSelectedStudent(s.name)}
                className="mobile-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.entries.length} subjects</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.grade.color}`}>{s.avg}%</p>
                  <p className="text-xs text-muted-foreground">{s.grade.grade}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
