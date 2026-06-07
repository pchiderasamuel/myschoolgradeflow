import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SessionLog {
  id: string;
  user_name: string;
  role: string;
  action: string;
  created_at: string;
  ip_address: string | null;
  device: string | null;
  school_id: string | null;
  tenant_id: string | null;
  school_name: string | null;
  tenant_name: string | null;
}

type FilterRole = "all" | string;
type FilterAction = "all" | "login" | "logout";

export default function SuperAdminSessionActivity() {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [filterAction, setFilterAction] = useState<FilterAction>("all");
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);

  const loadSessionLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch using the new RPC function
      const { data, error: queryError } = await supabase.rpc("get_all_tenant_sessions", {
        _limit: 50,
      });

      if (queryError) {
        throw queryError;
      }

      const sessionLogs = (data ?? []) as SessionLog[];
      setLogs(sessionLogs);

      // Extract unique tenants
      const uniqueTenants = new Map<string, string>();
      sessionLogs.forEach((log) => {
        if (log.tenant_id && log.tenant_name) {
          uniqueTenants.set(log.tenant_id, log.tenant_name);
        }
      });
      setTenants(Array.from(uniqueTenants.entries()).map(([id, name]) => ({ id, name })));
    } catch (err: any) {
      console.error("Error fetching session logs:", err);
      setError(err.message || "Failed to load session logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionLogs();

    // Set up realtime subscription for new session_logs
    const channel = supabase
      .channel("session_logs_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_logs",
        },
        (payload) => {
          // Prepend new log to the list
          const newLog = payload.new as SessionLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 50));
        }
      )
      .subscribe((status) => {
        if (status === "CLOSED") {
          console.warn("Realtime subscription closed");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter logs based on selected filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterRole !== "all" && log.role !== filterRole) return false;
      if (filterAction !== "all" && log.action.toLowerCase() !== filterAction) return false;
      if (filterTenant !== "all" && log.tenant_id !== filterTenant) return false;
      return true;
    });
  }, [logs, filterRole, filterAction, filterTenant]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    logs.forEach((log) => roles.add(log.role));
    return Array.from(roles).sort();
  }, [logs]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Failed to Load Session Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-700">{error}</p>
          <Button onClick={loadSessionLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Live Tenant Session Activity</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time login/logout activity across all schools
            </p>
          </div>
          <Button
            onClick={loadSessionLogs}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={filterTenant} onValueChange={setFilterTenant}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
            <p className="text-sm text-muted-foreground">Loading session activity...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No sessions found matching your filters</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full animate-pulse",
                        log.action.toLowerCase() === "login"
                          ? "bg-green-500"
                          : "bg-red-500"
                      )}
                    />
                    <span className="font-medium text-sm">{log.user_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.role}
                    </Badge>
                    <Badge
                      variant={
                        log.action.toLowerCase() === "login" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {log.action.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    {log.school_name && <span>School: {log.school_name}</span>}
                    {log.tenant_name && <span>Tenant: {log.tenant_name}</span>}
                    {log.device && <span title={log.device}>Device: {log.device.substring(0, 40)}...</span>}
                    {log.ip_address && <span>IP: {log.ip_address}</span>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  <span title={new Date(log.created_at).toLocaleString()}>
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
