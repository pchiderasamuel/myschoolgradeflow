import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Video, LogIn, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function PublicVirtualHub() {
  const { schoolCode } = useParams<{ schoolCode: string }>();
  const navigate = useNavigate();

  const [studentClass, setStudentClass] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branding, setBranding] = useState<{ name: string | null; logo: string | null }>({ name: null, logo: null });
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [virtualClasses, setVirtualClasses] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string[]>>({});
  
  const [joiningClass, setJoiningClass] = useState<string | null>(null);

  // Fetch school branding
  useEffect(() => {
    if (!schoolCode) return;
    fetch(`${SUPABASE_URL}/functions/v1/get-school-branding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ school_code: schoolCode }),
    })
      .then(r => r.json())
      .then(d => { if (d.name) setBranding({ name: d.name, logo: d.logo ?? null }); })
      .catch(() => {});
  }, [schoolCode]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentClass.trim() || !admissionNo.trim() || !schoolCode) return;

    setLoading(true);
    setError(null);
    setStudentInfo(null);
    setVirtualClasses([]);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/virtual-hub`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "fetch",
          school_code: schoolCode.toUpperCase(),
          class_name: studentClass.trim(),
          admission_no: admissionNo.trim(),
        }),
      });

      const data = await resp.json();

      if (data.error) {
        setError(data.error);
      } else {
        setStudentInfo(data.student);
        setVirtualClasses(data.virtualClasses || []);
        setAttendance(data.attendance || {});
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (vc: any) => {
    if (!studentInfo || !schoolCode) return;
    setJoiningClass(vc.id);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/virtual-hub`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "join",
          school_code: schoolCode,
          class_id: vc.id,
          student_name: studentInfo.name,
        }),
      });

      const resData = await resp.json();

      if (resData.error) {
        toast.error(`Attendance notice: ${resData.error}`);
      } else {
        toast.success("Joined class. Attendance logged!");
      }

      // Update local state so button says "Re-join"
      setAttendance(prev => {
        const current = prev[vc.id] || [];
        if (!current.includes(studentInfo.name)) {
          return { ...prev, [vc.id]: [...current, studentInfo.name] };
        }
        return prev;
      });

      window.open(vc.meetingLink, "_blank");

    } catch (e) {
      toast.error("Opening class link...");
      window.open(vc.meetingLink, "_blank");
    } finally {
      setJoiningClass(null);
    }
  };

  // Standard preset classes
  const PRESET_CLASSES = [
    "Creche", "Pre-Nursery", "Nursery 1", "Nursery 2", 
    "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
    "JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6">
      
      {/* Header */}
      {!studentInfo && (
        <div className="text-center mb-10 w-full max-w-md">
          {branding.logo ? (
            <img src={branding.logo} alt="Logo" className="w-24 h-24 rounded-full mx-auto mb-4 border border-slate-200 shadow-sm object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-indigo-100 flex items-center justify-center border border-indigo-200 text-indigo-500 shadow-sm">
              <Video size={40} />
            </div>
          )}
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {branding.name ? branding.name : "Virtual Hub"}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-2">
            Verify your identity to join your virtual classes.
          </p>
        </div>
      )}

      {/* Gateway Form */}
      {!studentInfo && (
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-0 ring-1 ring-slate-200/50">
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Class</label>
              <select
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                value={studentClass}
                onChange={e => setStudentClass(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select your class...</option>
                {PRESET_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admission Number</label>
              <input
                type="text"
                placeholder="e.g. ADM/2024/001"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                value={admissionNo}
                onChange={e => setAdmissionNo(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-semibold p-4 rounded-xl border border-red-100 flex items-start gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !studentClass || !admissionNo}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
              {loading ? "Verifying..." : "View My Classes"}
            </button>
          </form>
        </Card>
      )}

      {/* Dashboard */}
      {studentInfo && (
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Video className="text-indigo-600" />
                Virtual Classes
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Welcome, <span className="font-bold text-slate-700">{studentInfo.name}</span> ({studentClass})
              </p>
            </div>
            <button
              onClick={() => {
                setStudentInfo(null);
                setVirtualClasses([]);
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-4 py-2 rounded-lg transition-colors w-fit"
            >
              Change Student
            </button>
          </div>

          {virtualClasses.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2 shadow-sm bg-slate-50/50">
              <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-1">No Virtual Classes Scheduled</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                There are no upcoming virtual classes scheduled for {studentClass} at this time.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {virtualClasses.map((vc) => {
                const isPast = new Date(vc.endTime).getTime() < Date.now();
                const attended = attendance[vc.id]?.includes(studentInfo.name);

                return (
                  <Card key={vc.id} className={`p-5 flex flex-col shadow-sm transition-all ${isPast ? 'opacity-60 grayscale hover:grayscale-0' : 'border-l-4 border-l-indigo-500'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          {vc.topic}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">{vc.subject} &bull; {vc.teacherName}</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isPast ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700'}`}>
                        {isPast ? 'Completed' : 'Upcoming'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium mb-6 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <Calendar size={16} className="text-slate-400" />
                      {new Date(vc.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                      {" - "} 
                      {new Date(vc.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {" "}({new Date(vc.startTime).toLocaleDateString()})
                    </div>

                    <div className="mt-auto">
                      <button
                        onClick={() => handleJoinClass(vc)}
                        disabled={joiningClass === vc.id}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                          attended 
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                            : isPast 
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                        }`}
                      >
                        {joiningClass === vc.id ? (
                          <><Loader2 size={18} className="animate-spin" /> Joining...</>
                        ) : attended ? (
                          <><ExternalLink size={18} /> Re-join Class</>
                        ) : (
                          <><LogIn size={18} /> Join Class</>
                        )}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
