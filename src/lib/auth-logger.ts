import { supabase } from "@/integrations/supabase/client";

interface LogAuthEventParams {
  authType: "super_admin" | "tenant" | "staff";
  eventType: "login" | "logout";
  userId?: string;
  tenantId?: string;
  staffId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionToken?: string;
  userName?: string;
  schoolId?: string;
  role?: string;
}

/**
 * Logs authentication events (login/logout) to the database for audit trails
 */
export async function logAuthEvent({
  authType,
  eventType,
  userId,
  tenantId,
  staffId,
  ipAddress,
  userAgent,
  sessionToken,
  userName,
  schoolId,
  role,
}: LogAuthEventParams) {
  try {
    // Get client IP address if not provided (with geolocation fallback)
    let ip = ipAddress;
    if (!ip && typeof window !== "undefined") {
      // Try primary geolocation service (ipify)
      try {
        const response = await Promise.race([
          fetch("https://api.ipify.org?format=json"),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error("IP lookup timeout")), 3000)
          ),
        ]);
        
        if (response?.ok) {
          const data = await response.json();
          ip = data.ip;
        }
      } catch (e) {
        // Primary service failed, try fallback services
        try {
          const fallbackResponse = await Promise.race([
            fetch("https://api.my-ip.io/ip"),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error("Fallback IP lookup timeout")), 2000)
            ),
          ]);
          
          if (fallbackResponse?.ok) {
            ip = await fallbackResponse.text();
          }
        } catch (fallbackErr) {
          // Both services failed, log at trace level and continue
          console.debug("[auth-logger] IP geolocation unavailable, logging without IP", fallbackErr);
        }
      }
    }

    // Get user agent if not provided
    const ua = userAgent || navigator.userAgent;

    // Insert directly into session_logs table for school users and super admins
    if ((authType === "staff" && userId && schoolId && userName && role) || (authType === "super_admin" && userId)) {
      const { error } = await (supabase.from("session_logs") as any).insert({
        school_id: authType === "staff" ? schoolId : null,
        user_id: userId,
        user_name: authType === "super_admin" ? (userName || "Super Admin") : userName,
        role: authType === "super_admin" ? "super_admin" : role,
        action: eventType,
        ip_address: ip,
        device: ua,
      });

      if (error) {
        console.warn("Failed to log auth event to session_logs:", error);
      }
    } else {
      // For tenant, we can't log to session_logs (no school_id)
      // Log to console for debugging but don't fail
      console.log("[Auth Event]", {
        authType,
        eventType,
        userId,
        tenantId,
        staffId,
        ip_address: ip,
        user_agent: ua,
      });
    }
  } catch (e) {
    console.warn("Error logging auth event:", e);
    // Silently fail - don't block auth flows
  }
}

/**
 * Get login history for a specific user/tenant/staff
 */
export async function getLoginHistory(
  authType: "super_admin" | "tenant" | "staff",
  identifier: string,
  limit: number = 50
) {
  try {
    const { data, error } = await (supabase.rpc as any)("get_login_history", {
      _auth_type: authType,
      _identifier: identifier,
      _limit: limit,
    });

    if (error) {
      console.warn("Failed to fetch login history:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.warn("Error fetching login history:", e);
    return [];
  }
}

/**
 * Get the current client's IP address
 */
export async function getCurrentClientIp(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (e) {
    console.warn("Failed to fetch client IP:", e);
  }
  return null;
}
