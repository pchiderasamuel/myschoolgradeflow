import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getSchoolDetail, getSchoolBilling, updateSchoolFeatures, updateBillingPlan, updateSchoolStatus, getAllTenantActivityLogs } from "@/supabase/schoolService";
import { ArrowLeft, Loader2, ShieldOff, ShieldCheck } from "lucide-react";

interface SchoolDetail {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string;
  logo: string | null;
  timezone: string;
  academic_year: string;
  current_term: string;
  features: Record<string, boolean>;
  max_students: number;
  current_students: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BillingDetail {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  starter:    { attendance: true, results: true, fees: false, library: false, events: true },
  pro:        { attendance: true, results: true, fees: true,  library: false, events: true },
  enterprise: { attendance: true, results: true, fees: true,  library: true,  events: true },
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 500, pro: 2000, enterprise: 10000,
};

export default function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [billing, setBilling] = useState<BillingDetail | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("starter");

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [schoolData, billingData, logsData] = await Promise.all([
        getSchoolDetail(schoolId),
        getSchoolBilling(schoolId),
        getAllTenantActivityLogs(10, 0, schoolId),
      ]);
      setSchool(schoolData as SchoolDetail);
      setSelectedPlan((billingData as BillingDetail)?.plan ?? "starter");
      setBilling(billingData as BillingDetail | null);
      setRecentLogs(logsData.data);
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId]); // eslint-disable-line

  const handlePlanChange = async () => {
    if (!schoolId) return;
    setSavingPlan(true);
    try {
      // Atomically update school features + max_students to match plan
      await updateSchoolFeatures(schoolId, PLAN_FEATURES[selectedPlan], PLAN_LIMITS[selectedPlan]);
      
      // Update billing plan
      await updateBillingPlan(schoolId, selectedPlan);

      toast({ title: "Plan updated", description: `Switched to ${selectedPlan}` });
      load();
    } catch (e) {
      toast({ title: "Plan update failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingPlan(false); }
  };

  const setStatus = async (status: "active" | "suspended") => {
    if (!schoolId) return;
    setSavingStatus(true);
    try {
      await updateSchoolStatus(schoolId, status);
      toast({ title: `School ${status === "suspended" ? "suspended" : "reactivated"}` });
      load();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (!school) return <p className="text-slate-400 text-center py-16">School not found</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/schools")}>
          <ArrowLeft size={14} className="mr-1" /> Schools
        </Button>
        <h1 className="text-xl font-bold text-slate-800">{school.name}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${school.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {school.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* School profile */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">School Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Code" value={school.code} mono />
            <Row label="Email" value={school.email ?? "—"} />
            <Row label="Phone" value={school.phone ?? "—"} />
            <Row label="City" value={[school.address_city, school.address_state].filter(Boolean).join(", ") || "—"} />
            <Row label="Country" value={school.address_country} />
            <Row label="Timezone" value={school.timezone} />
            <Row label="Academic Year" value={school.academic_year} />
            <Row label="Current Term" value={school.current_term} />
            <Row label="Created" value={new Date(school.created_at).toLocaleDateString()} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Students + status */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Capacity & Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Students</p>
                <p className="text-2xl font-bold text-slate-800">{school.current_students} <span className="text-sm font-normal text-slate-400">/ {school.max_students}</span></p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min((school.current_students / school.max_students) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Enabled Features</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(school.features ?? {}).map(([k, v]) => (
                    <Badge key={k} variant={v ? "default" : "outline"} className="text-xs">
                      {v ? "✓" : "✗"} {k}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                {school.status !== "suspended" ? (
                  <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" disabled={savingStatus} onClick={() => setStatus("suspended")}>
                    {savingStatus ? <Loader2 size={12} className="animate-spin mr-1" /> : <ShieldOff size={12} className="mr-1" />} Suspend
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" disabled={savingStatus} onClick={() => setStatus("active")}>
                    {savingStatus ? <Loader2 size={12} className="animate-spin mr-1" /> : <ShieldCheck size={12} className="mr-1" />} Reactivate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Billing & Plan</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {billing ? (
                <>
                  <Row label="Plan" value={billing.plan} />
                  <Row label="Status" value={billing.status} />
                  <Row label="Trial Ends" value={billing.trial_ends_at ? new Date(billing.trial_ends_at).toLocaleDateString() : "—"} />
                  <Row label="Period Start" value={billing.current_period_start ? new Date(billing.current_period_start).toLocaleDateString() : "—"} />
                  <Row label="Period End" value={billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : "—"} />
                </>
              ) : (
                <p className="text-slate-400 text-xs">No billing record found</p>
              )}

              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-slate-500">Change Plan</p>
                <div className="flex gap-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="h-8 flex-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (500 students)</SelectItem>
                      <SelectItem value="pro">Pro (2,000 students)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (10,000 students)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handlePlanChange} disabled={savingPlan}>
                    {savingPlan ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">Updates features JSONB + max_students atomically</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Tenant Activity */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Tenant Activity</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/superadmin/activity?school=${schoolId}`)}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No recent granular activity recorded for this school.</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-start border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{log.action}</p>
                    <p className="text-xs text-slate-500">by <span className="font-mono">{log.staff_id}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-800 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
