import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionLog {
  id: string;
  user_id: string;
  event: "LOGIN" | "LOGOUT";
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
  provider: string | null;
}

function parseUserAgent(ua: string | null): string {
  if (!ua || ua === "unknown") return "Unknown Device";

  const uaLower = ua.toLowerCase();

  // Detect Operating System
  let os = "";
  if (uaLower.includes("windows")) os = "Windows";
  else if (uaLower.includes("macintosh") || uaLower.includes("mac os")) os = "macOS";
  else if (uaLower.includes("iphone")) os = "iPhone";
  else if (uaLower.includes("ipad")) os = "iPad";
  else if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("linux")) os = "Linux";

  // Detect Browser
  let browser = "";
  if (uaLower.includes("firefox")) browser = "Firefox";
  else if (uaLower.includes("opera") || uaLower.includes("opr")) browser = "Opera";
  else if (uaLower.includes("edg")) browser = "Edge";
  else if (uaLower.includes("chrome") && !uaLower.includes("chromium")) browser = "Chrome";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari";

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;

  // Fallback to a truncated version of raw UA string if parsing yields nothing
  return ua.length > 40 ? ua.slice(0, 37) + "..." : ua;
}

export default function SessionHistory() {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessionLogs() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from("session_logs")
          .select("id, user_id, event, timestamp, ip_address, user_agent, provider")
          .order("timestamp", { ascending: false })
          .limit(20);

        if (queryError) {
          throw queryError;
        }

        setLogs((data as SessionLog[]) ?? []);
      } catch (err: any) {
        console.error("Error fetching session logs:", err.message);
        setError("Failed to load session logs. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSessionLogs();

    // Set up realtime subscription for INSERT events
    const channel = supabase
      .channel("session_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_logs",
        },
        (payload) => {
          const newLog = payload.new as SessionLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <Shield size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Session History</h2>
          <p className="text-xs text-slate-400">Track and monitor your login & logout activity</p>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <p className="text-sm text-slate-400">Loading your session history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
            <p className="text-sm text-slate-400 font-medium">No session history entries found.</p>
            <p className="text-xs text-slate-400 mt-1">Activity logs will appear here after your next session change.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Event</th>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Provider</th>
                  <th className="px-6 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold select-none",
                          log.event === "LOGIN"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {log.event}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 capitalize whitespace-nowrap">
                      {log.provider ?? "Email"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {log.ip_address ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[250px] truncate" title={log.user_agent ?? ""}>
                      {parseUserAgent(log.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
