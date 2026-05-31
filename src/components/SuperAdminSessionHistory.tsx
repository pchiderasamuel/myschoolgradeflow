import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface SessionLog {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
  ip_address: string | null;
  device: string | null;
  user_name: string | null;
  role: string | null;
  school_id: string | null;
}

interface UserOption {
  id: string;
  name: string | null;
}

export default function SuperAdminSessionHistory() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role check - only super admins can access this
  if (role !== "super_admin") {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-red-600 font-medium">Access denied. Super admin privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  const fetchSessionLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use RPC to bypass RLS for super admin
      const { data, error: queryError } = await supabase.rpc("get_all_session_logs", {
        limit: 100,
      });

      if (queryError) throw queryError;

      const logsData = (data as SessionLog[]) ?? [];
      setLogs(logsData);

      // Extract unique users from logs
      const uniqueUsers = new Map<string, UserOption>();
      logsData.forEach((log) => {
        if (!uniqueUsers.has(log.user_id)) {
          uniqueUsers.set(log.user_id, {
            id: log.user_id,
            name: log.user_name || null,
          });
        }
      });
      setUsers(Array.from(uniqueUsers.values()).sort((a, b) => 
        (a.name || "").localeCompare(b.name || "")
      ));
    } catch (err: any) {
      console.error("Error fetching session logs:", err.message);
      setError("Failed to load session logs. Please try again.");
      toast({
        title: "Error loading session logs",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionLogs();
  }, []);

  const filteredLogs = selectedUserId === "all" 
    ? logs 
    : logs.filter((log) => log.user_id === selectedUserId);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Shield size={20} />
            </div>
            <div>
              <CardTitle className="text-base">Global Session History</CardTitle>
              <p className="text-xs text-slate-400">View all user login & logout activity across the platform</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSessionLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Filter by user:</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedUser && (
            <Badge variant="outline" className="ml-2">
              {selectedUser.name}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <p className="text-sm text-slate-400">Loading session history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
            <p className="text-sm text-slate-400 font-medium">
              {selectedUserId === "all" ? "No session history entries found." : "No session history for this user."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-4 py-3.5">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-700">
                        {log.user_name || log.user_id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold select-none",
                          log.action === "LOGIN" || log.action === "login"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize whitespace-nowrap text-xs">
                      {log.role ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                      {log.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate text-xs" title={log.device ?? ""}>
                      {log.device ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
