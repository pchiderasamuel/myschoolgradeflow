import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SessionLog {
  id: string;
  user_name: string;
  role: string;
  action: string;
  created_at: string;
  device: string | null;
}

type FilterRole = "all" | string;
type FilterAction = "all" | "login" | "logout";

export default function SchoolAdminSessionActivity() {
  const { schoolId, role } = useAuth();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [filterAction, setFilterAction] = useState<FilterAction>("all");

  // Only allow school admins and higher roles
  const canAccess = role && ["school_admin", "principal", "head_teacher"].includes(role);

  if (!canAccess) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-600" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-700">
            Only school administrators can view staff session activity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const loadSessionLogs = async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);
    try {
      // Use the RPC function to get only this school's sessions
      const { data, error: queryError } = await supabase.rpc("get_school_sessions", {
        _limit: 30,
      });

      if (queryError) {
        throw queryError;
      }

      setLogs((data ?? []) as SessionLog[]);
    } catch (err: any) {
      console.error("Error fetching school session logs:", err);
      setError(err.message || "Failed to load session logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionLogs();

    // Set up realtime subscription for new session_logs in this school
    const channel = supabase
      .channel(`school_sessions_${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_logs",
        },
        (payload) => {
          const newLog = payload.new as SessionLog;
          // Only prepend if it matches the school filter (this is enforced by RLS on the server)
          setLogs((prev) => [newLog, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  // Filter logs based on selected filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterRole !== "all" && log.role !== filterRole) return false;
      if (filterAction !== "all" && log.action.toLowerCase() !== filterAction) return false;
      return true;
    });
  }, [logs, filterRole, filterAction]);

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
            <CardTitle>Staff Session Activity</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Login and logout activity for your school staff
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
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
            <p className="text-sm text-muted-foreground">Loading staff activity...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No sessions found</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  {log.device && (
                    <p className="text-xs text-muted-foreground" title={log.device}>
                      {log.device.substring(0, 50)}...
                    </p>
                  )}
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
