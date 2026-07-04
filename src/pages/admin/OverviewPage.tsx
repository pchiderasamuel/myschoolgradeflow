import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSchool } from "@/hooks/useSchool";
import { getTeachers, getClasses, getRecentActivity, updateSchoolProfile, getStudentSummary } from "@/supabase/schoolService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, BookOpen, CalendarDays, Loader2, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AttendanceWidget from "@/components/dashboard/AttendanceWidget";
import SessionLog from "@/components/SessionLog";
import StudentOverviewCard from "@/components/dashboard/StudentOverviewCard";
import { supabase } from "@/integrations/supabase/client";
import { buildStaffInviteLink, generateStaffInviteToken } from "@/lib/staff-invite";

const TERM_LABELS = { first: "1st Term", second: "2nd Term", third: "3rd Term" };

export default function OverviewPage() {
  const { schoolId } = useAuth();
  const { school, setSchool, loading: schoolLoading } = useSchool();
  const { toast } = useToast();

  const [studentTotal, setStudentTotal] = useState<number | null>(null);
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [classCount, setClassCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<{ id: number; action: string; details: string | null; timestamp: string }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    setLoadingStats(true);
    Promise.all([
      getTeachers(schoolId),
      getClasses(schoolId),
      getRecentActivity(schoolId, 10),
      getStudentSummary(schoolId),
    ]).then(([teachers, classes, logs, summary]) => {
      setTeacherCount(teachers.length);
      setClassCount(classes.length);
      setActivity(logs);
      setStudentTotal(summary.total);
    }).catch((e) => console.error(e))
      .finally(() => setLoadingStats(false));

    // Setup realtime subscription
    const channel = supabase
      .channel(`tenant_activity:${schoolId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tenant_activity_logs", filter: `tenant_id=eq.${schoolId}` },
        (payload) => {
          const newLog = payload.new as any;
          setActivity((prev) => {
            const formattedLog = {
              id: newLog.id,
              action: newLog.action,
              details: newLog.details,
              timestamp: newLog.created_at,
            };
            return [formattedLog, ...prev].slice(0, 10);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId]);

  const handleTermChange = async (term: string) => {
    if (!schoolId || !school) return;
    try {
      const updated = await updateSchoolProfile(schoolId, { current_term: term as "first" | "second" | "third" });
      setSchool(updated);
      toast({ title: "Term updated", description: `Now in ${TERM_LABELS[term as keyof typeof TERM_LABELS]}` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const stats = [
    { label: "Total Students",  value: studentTotal ?? "—",           icon: Users,          color: "bg-blue-50 text-blue-600" },
    { label: "Total Teachers",  value: teacherCount ?? "—",           icon: GraduationCap,  color: "bg-emerald-50 text-emerald-600" },
    { label: "Total Classes",   value: classCount ?? "—",             icon: BookOpen,       color: "bg-purple-50 text-purple-600" },
    { label: "Current Term",    value: TERM_LABELS[school?.current_term as keyof typeof TERM_LABELS] ?? "—", icon: CalendarDays, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500">{school?.academic_year} Academic Year</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs w-full sm:w-auto justify-center sm:justify-start"
            onClick={async () => {
              const slug = localStorage.getItem("schoolapp_school_slug") || localStorage.getItem("school_slug");
              if (!slug) {
                toast({ title: "No link available", description: "School slug not found. Try logging in via the school PIN first.", variant: "destructive" });
                return;
              }

              try {
                const { token } = await generateStaffInviteToken(slug);
                const url = buildStaffInviteLink(window.location.origin, slug, token);
                await navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2500);
              } catch (error) {
                toast({ title: "Could not create invite link", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
              }
            }}
          >
            {linkCopied ? <><Check size={14} className="text-emerald-600" /> Copied!</> : <><Share2 size={14} /> Share Staff Login Link</>}
          </Button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">Current Term:</span>
            <Select value={school?.current_term ?? "first"} onValueChange={handleTermChange}>
              <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              <SelectItem value="first">1st Term</SelectItem>
              <SelectItem value="second">2nd Term</SelectItem>
              <SelectItem value="third">3rd Term</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>
                  <s.icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {loadingStats && s.label !== "Current Term" ? <span className="text-sm text-slate-400">Loading…</span> : s.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Student Overview — gender breakdown with class filter */}
      <StudentOverviewCard />

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No recent activity</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((log) => (
                <li key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="outline" className="text-xs mr-2">{log.action}</Badge>
                    <span className="text-sm text-slate-600">{log.details ?? ""}</span>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Live attendance widget */}
      <Card>
        <CardContent className="pt-5">
          <AttendanceWidget />
        </CardContent>
      </Card>

      {/* Session log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Logins &amp; Logouts</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionLog />
        </CardContent>
      </Card>
    </div>
  );
}
