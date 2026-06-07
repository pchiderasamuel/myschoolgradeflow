import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SessionLog {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
  ip_address: string | null;
  device: string | null;
}

export default function StaffSessionHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchSessionLogs() {
      setLoading(true);
      setError(null);
      try {
        // Fetch only the current user's session logs
        const { data, error: queryError } = await supabase
          .from("session_logs")
          .select("id, user_id, action, created_at, ip_address, device")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (queryError) {
          throw queryError;
        }

        setLogs((data ?? []) as SessionLog[]);
      } catch (err: any) {
        console.error("Error fetching session logs:", err);
        setError("Failed to load your session history");
      } finally {
        setLoading(false);
      }
    }

    fetchSessionLogs();
  }, [user]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Session History</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Your recent login and logout activity
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
            <p className="text-sm text-muted-foreground">Loading your session history...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <p className="text-sm text-muted-foreground">No session history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      log.action.toLowerCase() === "login"
                        ? "bg-green-500"
                        : "bg-red-500"
                    )}
                  />
                  <Badge
                    variant={
                      log.action.toLowerCase() === "login" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {log.action.toUpperCase()}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {log.device && (
                    <span title={log.device}>
                      Device: {log.device.substring(0, 30)}...
                    </span>
                  )}
                  {log.ip_address && <span>IP: {log.ip_address}</span>}
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
