import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getActivityLogs, getSchoolsForFilter, getAllTenantActivityLogs } from "@/supabase/schoolService";
import { RefreshCw, Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";

interface PlatformLog {
  id: number;
  school_id: string | null;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  school_name?: string | null;
}

interface TenantLog {
  id: number;
  tenant_id: string;
  school_name: string;
  staff_id: string;
  action: string;
  details: string | null;
  timestamp: string;
}

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  provision:       "bg-violet-100 text-violet-700",
  suspend:         "bg-red-100 text-red-600",
  reactivate:      "bg-emerald-100 text-emerald-700",
  plan_change:     "bg-blue-100 text-blue-700",
  student_add:     "bg-sky-100 text-sky-700",
  student_import:  "bg-sky-100 text-sky-700",
  teacher_add:     "bg-indigo-100 text-indigo-700",
  attendance_save: "bg-amber-100 text-amber-700",
  result_save:     "bg-orange-100 text-orange-700",
  fee_create:      "bg-teal-100 text-teal-700",
  payment_success: "bg-emerald-100 text-emerald-700",
};

export default function ActivityLogPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("platform");

  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterSchoolId, setFilterSchoolId] = useState("all");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  // Platform state
  const [pLogs, setPLogs] = useState<PlatformLog[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [pPage, setPPage] = useState(0);
  const [pHasMore, setPHasMore] = useState(false);
  const [pTotal, setPTotal] = useState(0);

  // Tenant state
  const [tLogs, setTLogs] = useState<TenantLog[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [tPage, setTPage] = useState(0);
  const [tHasMore, setTHasMore] = useState(false);
  const [tTotal, setTTotal] = useState(0);

  // Load distinct schools for filter dropdown
  useEffect(() => {
    getSchoolsForFilter()
      .then((data) => {
        setSchools(data as { id: string; name: string }[]);
      })
      .catch(() => {
        setSchools([]);
      });
  }, []);

  const loadPlatform = useCallback(async (p = 0) => {
    setPLoading(true);
    try {
      const schoolId = filterSchoolId === "all" ? undefined : filterSchoolId;
      const data = await getActivityLogs(schoolId, PAGE_SIZE * (p + 1));
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const pageData = data.slice(from, to);
      
      setPLogs(pageData as PlatformLog[]);
      setPTotal(data.length);
      setPHasMore(data.length > to);
      setPPage(p);
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setPLoading(false);
    }
  }, [filterSchoolId, toast]);

  const loadTenant = useCallback(async (p = 0) => {
    setTLoading(true);
    try {
      const { data, total_count } = await getAllTenantActivityLogs(PAGE_SIZE, p * PAGE_SIZE, filterSchoolId);
      setTLogs(data as TenantLog[]);
      setTTotal(total_count);
      setTHasMore((p + 1) * PAGE_SIZE < total_count);
      setTPage(p);
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setTLoading(false);
    }
  }, [filterSchoolId, toast]);

  // Load whichever tab is active when filters change
  useEffect(() => {
    if (activeTab === "platform") loadPlatform(0);
    else loadTenant(0);
  }, [activeTab, filterSchoolId, loadPlatform, loadTenant]);

  const displayedPlatform = search
    ? pLogs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.details ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : pLogs;

  const displayedTenant = search
    ? tLogs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.details ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : tLogs;

  const distinctPlatformActions = Array.from(new Set(pLogs.map((l) => l.action))).sort();
  const distinctTenantActions = Array.from(new Set(tLogs.map((l) => l.action))).sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Activity Log</h1>
          <p className="text-sm text-slate-500">
            {activeTab === "platform" 
              ? `Page ${pPage + 1} · ${pTotal.toLocaleString()} total entries`
              : `Page ${tPage + 1} · ${tTotal.toLocaleString()} total entries`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => activeTab === "platform" ? loadPlatform(pPage) : loadTenant(tPage)} disabled={activeTab === "platform" ? pLoading : tLoading}>
          <RefreshCw size={14} className={activeTab === "platform" && pLoading || activeTab === "tenant" && tLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-8 h-8 w-52 text-sm"
            placeholder="Search action or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); activeTab === "platform" ? loadPlatform(0) : loadTenant(0); }}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {(activeTab === "platform" ? distinctPlatformActions : distinctTenantActions).map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSchoolId} onValueChange={(v) => { setFilterSchoolId(v); }}>
          <SelectTrigger className="w-52 h-8 text-sm"><SelectValue placeholder="All Schools" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="platform">Platform Events</TabsTrigger>
          <TabsTrigger value="tenant">Granular Tenant Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            {pLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : displayedPlatform.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">No activity logs found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Time", "Action", "School", "Performed By", "Details"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPlatform.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.school_name ?? (log.school_id ? <span className="font-mono">{log.school_id.slice(0, 8)}…</span> : <span className="text-slate-300">platform</span>)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {log.performed_by ? log.performed_by.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-slate-400 hover:text-slate-600">View</summary>
                            <pre className="mt-1 text-xs bg-slate-50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Platform Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-400">
              Showing rows {pPage * PAGE_SIZE + 1}–{Math.min((pPage + 1) * PAGE_SIZE, pTotal)} of {pTotal}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pPage === 0 || pLoading} onClick={() => loadPlatform(pPage - 1)}>
                <ChevronLeft size={14} className="mr-1" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!pHasMore || pLoading} onClick={() => loadPlatform(pPage + 1)}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tenant">
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            {tLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : displayedTenant.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">No granular tenant logs found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Time", "Action", "School", "Staff", "Details"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTenant.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.school_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                        {log.staff_id}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-slate-400 hover:text-slate-600">View</summary>
                            <pre className="mt-1 text-xs bg-slate-50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                              {log.details}
                            </pre>
                          </details>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Tenant Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-400">
              Showing rows {tPage * PAGE_SIZE + 1}–{Math.min((tPage + 1) * PAGE_SIZE, tTotal)} of {tTotal}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={tPage === 0 || tLoading} onClick={() => loadTenant(tPage - 1)}>
                <ChevronLeft size={14} className="mr-1" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!tHasMore || tLoading} onClick={() => loadTenant(tPage + 1)}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
