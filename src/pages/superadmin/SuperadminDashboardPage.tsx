import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getActivityLogs } from "@/supabase/schoolService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, School, Users, GraduationCap, CreditCard, PlusCircle, Activity, ChevronRight } from "lucide-react";
import SessionLog from "@/components/SessionLog";

interface Stats {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalPaymentsSuccess: number;
  totalRevenueCollected: number;
  schoolsOnStarter: number;
  schoolsOnPro: number;
  schoolsOnEnterprise: number;
}

interface PlatformLog {
  id: number;
  school_id: string | null;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  school_name?: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  provision:       "bg-violet-100 text-violet-700",
  suspend:         "bg-red-100 text-red-600",
  reactivate:      "bg-emerald-100 text-emerald-700",
  plan_change:     "bg-blue-100 text-blue-700",
};

export default function SuperadminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<PlatformLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      try {
        const [schoolsRes, studentsRes, teachersRes, paymentsRes, billingRes, logsData] = await Promise.allSettled([
          db.from("schools").select("id,status", { count: "exact" }),
          db.from("students").select("id", { count: "exact" }),
          db.from("teachers").select("id", { count: "exact" }),
          db.from("payments").select("amount,status").eq("status", "success"),
          db.from("billing").select("plan"),
          getActivityLogs(undefined, 5), // Fetch 5 most recent platform logs
        ]);

        const schools = schoolsRes.status === "fulfilled" ? (schoolsRes.value.data ?? []) as { id: string; status: string }[] : [];
        const studentsCount = studentsRes.status === "fulfilled" ? (studentsRes.value.count ?? 0) : 0;
        const teachersCount = teachersRes.status === "fulfilled" ? (teachersRes.value.count ?? 0) : 0;
        const payments = paymentsRes.status === "fulfilled" ? (paymentsRes.value.data ?? []) as { amount: number; status: string }[] : [];
        const billing = billingRes.status === "fulfilled" ? (billingRes.value.data ?? []) as { plan: string }[] : [];

        setStats({
          totalSchools: schools.length,
          activeSchools: schools.filter((s) => s.status === "active").length,
          suspendedSchools: schools.filter((s) => s.status === "suspended").length,
          totalStudents: studentsCount,
          totalTeachers: teachersCount,
          totalPaymentsSuccess: payments.length,
          totalRevenueCollected: payments.reduce((sum, p) => sum + Number(p.amount), 0),
          schoolsOnStarter: billing.filter((b) => b.plan === "starter").length,
          schoolsOnPro: billing.filter((b) => b.plan === "pro").length,
          schoolsOnEnterprise: billing.filter((b) => b.plan === "enterprise").length,
        });

        if (logsData.status === "fulfilled") {
          setLogs(logsData.value as PlatformLog[]);
        }
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (!stats) return null;

  const topCards = [
    { label: "Total Schools",        value: stats.totalSchools,            icon: School,       color: "bg-violet-50 text-violet-600" },
    { label: "Active Schools",       value: stats.activeSchools,           icon: School,       color: "bg-emerald-50 text-emerald-600" },
    { label: "Total Students",       value: stats.totalStudents,           icon: Users,        color: "bg-blue-50 text-blue-600" },
    { label: "Revenue Collected",    value: `₦${stats.totalRevenueCollected.toLocaleString("en-NG")}`, icon: CreditCard, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Platform overview and quick actions.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-violet-600 hover:bg-violet-700">
            <Link to="/superadmin/provision">
              <PlusCircle size={16} className="mr-2" />
              Provision School
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${c.color}`}>
                  <c.icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">{c.label}</p>
                  <p className="text-xl font-bold text-slate-800">{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Actions & Plan Distribution */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/superadmin/schools" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <School size={16} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Manage Schools</span>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
              <Link to="/superadmin/billing" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard size={16} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Billing & Subscriptions</span>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
              <Link to="/superadmin/activity" className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Full Activity Log</span>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Plan Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { plan: "Starter", count: stats.schoolsOnStarter,    color: "border-amber-200 bg-amber-50 text-amber-700" },
                  { plan: "Pro",     count: stats.schoolsOnPro,        color: "border-blue-200 bg-blue-50 text-blue-700" },
                  { plan: "Enterprise", count: stats.schoolsOnEnterprise, color: "border-violet-200 bg-violet-50 text-violet-700" },
                ].map((p) => (
                  <div key={p.plan} className={`rounded-xl border p-3 text-center ${p.color}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider">{p.plan}</p>
                    <p className="text-xl font-bold mt-1">{p.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Activity & Session Log */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Platform Activity</CardTitle>
              <Link to="/superadmin/activity" className="text-xs font-medium text-violet-600 hover:text-violet-700">View All</Link>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-400">No recent activity.</p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.action}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">
                          {log.school_name ?? (log.school_id ? <span className="font-mono text-xs">{log.school_id.slice(0, 8)}…</span> : "System Action")}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(log.created_at).toLocaleString()} · by <span className="font-mono">{log.performed_by ? log.performed_by.slice(0, 8) + "…" : "system"}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Live Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <SessionLog superadmin />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
