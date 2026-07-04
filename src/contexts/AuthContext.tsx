import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { insertSessionLog, getUserRole, checkUserRole, getUserProfile } from "@/supabase/schoolService";
import { useToast } from "@/hooks/use-toast";
import { getEffectiveRole, normalizeRole } from "@/lib/auth-role";

export type AppRole = "super_admin" | "school_admin" | "authorised_staff" | "principal" | "head_teacher" | "teacher" | "student" | "unassigned";

export interface AuthProfile {
  userId: string;
  email: string | null;
  role: AppRole;
  schoolId: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  schoolId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Log session events (LOGIN/LOGOUT) to both edge function and database
 * This is called from onAuthStateChange to capture authentication events
 */
async function logSessionEvent(
  user: User | { id: string; app_metadata?: any; identities?: any },
  eventType: "LOGIN" | "LOGOUT",
  profile?: AuthProfile | null
): Promise<void> {
  try {
    // First, log via edge function to capture IP and other metadata
    const { error: edgeFuncError } = await supabase.functions.invoke("log-session", {
      body: { user, event_type: eventType.toUpperCase() },
      contentType: "application/json",
    });
    
    if (edgeFuncError) {
      console.warn(`Failed to invoke log-session edge function for ${eventType}:`, edgeFuncError);
    }

    // Second, insert directly into session_logs table with profile information
    // This ensures the event is captured even if the edge function fails
    const userEmail = (user as User)?.email || (user as any)?.identities?.[0]?.identity || "unknown";
    const userName = profile?.firstName && profile?.lastName 
      ? `${profile.firstName} ${profile.lastName}` 
      : userEmail;
    
    const { error: dbError } = await supabase.from("session_logs").insert({
      user_id: user.id,
      user_name: userName,
      role: profile?.role || "unassigned",
      action: eventType.toLowerCase(),
      school_id: profile?.schoolId || null,
      // tenant_id would be extracted from profile if available
      device: typeof navigator !== "undefined" ? navigator.userAgent : null,
      // IP address will be added by the edge function, or can be set to null here
    });

    if (dbError) {
      console.warn(`Failed to insert ${eventType} event into session_logs:`, dbError);
    }
  } catch (err) {
    console.warn(`Error logging session event (${eventType}):`, err);
    // Don't block auth flow if logging fails
  }
}

async function fetchProfile(userId: string, email: string | null): Promise<AuthProfile> {
  const profileRow = await getUserProfile(userId);
  const normalizedFromProfile = normalizeRole(profileRow?.role ?? null);
  let resolvedRole: AppRole = normalizedFromProfile ?? "unassigned";

  if (!profileRow || resolvedRole === "unassigned") {
    const isSuperAdmin = await checkUserRole(userId, "super_admin");
    if (isSuperAdmin) {
      resolvedRole = "super_admin";
    }
  }

  return {
    userId,
    email,
    role: resolvedRole,
    schoolId: profileRow?.school_id ?? null,
    firstName: profileRow?.first_name ?? null,
    lastName: profileRow?.last_name ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef<AuthProfile | null>(null);
  const currentUserRef = useRef<User | null>(null);
  // Track last login event time per user to avoid duplicates from token refresh
  const lastLoginTimeRef = useRef<Record<string, number>>({});
  const { toast } = useToast();
  const sessionExpiredShownRef = useRef(false);
  // Track listener references for proper cleanup and memory leak prevention
  const storageListenerRef = useRef<((e: StorageEvent) => void) | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // NOTE: We do NOT call getSession() + fetchProfile here separately.
    // onAuthStateChange fires with INITIAL_SESSION for existing sessions,
    // so letting it be the single source of truth prevents the race condition
    // where two concurrent fetchProfile calls could override each other.
    // We only call getSession to quickly determine if there's NO session
    // so we can stop the loading spinner immediately.
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null;
      // Always sync session/user immediately so ProtectedRoute never sees null session
      // for a logged-in user. Profile loading is handled by onAuthStateChange.
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        currentUserRef.current = s.user;
        // onAuthStateChange (INITIAL_SESSION) will call fetchProfile — don't do it here
        // to avoid the double-fetch race condition.
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        currentUserRef.current = s.user;
        setLoading(true);
        fetchProfile(s.user.id, s.user.email ?? null)
          .then((p) => {
            let parsedBridge: { role?: string } | null = null;
            try {
              const bridgeRole = typeof window !== "undefined" ? window.localStorage.getItem("pin_bridge_session") : null;
              parsedBridge = bridgeRole ? JSON.parse(bridgeRole) : null;
            } catch {
              parsedBridge = null;
            }
            const effectiveRole = getEffectiveRole(p.role, parsedBridge?.role);
            const resolvedProfile: AuthProfile = {
              ...p,
              role: (effectiveRole ?? p.role) as AppRole,
            };
            setProfile(resolvedProfile);
            profileRef.current = resolvedProfile;
            setLoading(false);
            // Log login once per user within a 5-minute window to prevent duplicates from token refresh
            if (event === "SIGNED_IN") {
              const userId = s.user.id;
              const now = Date.now();
              const lastLoginTime = lastLoginTimeRef.current[userId] ?? 0;
              const fiveMinutes = 5 * 60 * 1000;
              
              if (now - lastLoginTime > fiveMinutes) {
                lastLoginTimeRef.current[userId] = now;
                sessionExpiredShownRef.current = false;
                logSessionEvent(s.user, "LOGIN", resolvedProfile);
              }
            }
          })
          .catch((err) => {
            console.error("[AuthContext] Failed to fetch profile:", err);
            // If we already have a valid profile loaded (e.g. from a previous
            // successful fetch), keep it rather than overriding with "unassigned".
            // This prevents the race condition where a second fetch failure
            // after a successful first fetch causes an Access Denied redirect.
            if (profileRef.current && profileRef.current.role !== "unassigned") {
              console.warn("[AuthContext] Keeping existing valid profile after fetch error.");
              setLoading(false);
              return;
            }
            // No prior valid profile — fall back to unassigned
            const fallbackProfile: AuthProfile = {
              userId: s.user.id,
              email: s.user.email ?? null,
              role: "unassigned",
              schoolId: null,
              firstName: null,
              lastName: null,
            };
            setProfile(fallbackProfile);
            profileRef.current = fallbackProfile;
            setLoading(false);
            toast({
              title: "Warning",
              description: "Could not load your profile. Some features may be unavailable.",
              variant: "destructive",
            });
          });
      } else {
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
        
        // Log logout event on SIGNED_OUT using the cached user object
        if (event === "SIGNED_OUT") {
          if (currentUserRef.current) {
            // Use the cached profile information for logout logging
            logSessionEvent(currentUserRef.current, "LOGOUT", profileRef.current || undefined);
            currentUserRef.current = null;
          }
          
          // Only show "session expired" if this wasn't a manual sign-out
          // and wasn't triggered by an INITIAL_SESSION event
          if (!sessionExpiredShownRef.current) {
            sessionExpiredShownRef.current = true;
            toast({
              title: "Session expired",
              description: "Your session has expired. Please log in again.",
              variant: "destructive",
            });
          }
        }
      }
    });

    // Cross-tab session invalidation with proper scope and cleanup
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === "supabase-auth-token" && e.newValue === null) {
        // Another tab logged out - clear local state
        setSession(null);
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        lastLoginTimeRef.current = {};
        currentUserRef.current = null;
      }
    };
    
    // Store listener reference to ensure proper cleanup
    storageListenerRef.current = handleStorageChange;
    window.addEventListener("storage", handleStorageChange);
    
    // Store auth unsubscribe function
    const unsubscribeAuth = (() => {
      const sub = listener.subscription.unsubscribe;
      authUnsubscribeRef.current = sub;
      return sub;
    })();

    return () => {
      // Clean up auth state listener
      unsubscribeAuth();
      
      // Clean up storage listener with stored reference
      if (storageListenerRef.current) {
        window.removeEventListener("storage", storageListenerRef.current);
        storageListenerRef.current = null;
      }
      
      // Clear all refs to prevent memory leaks
      authUnsubscribeRef.current = null;
    };
  }, [toast]);

  const signOut = async () => {
    console.log("[AuthContext] signOut called");
    sessionExpiredShownRef.current = true; // Prevent showing expired toast on manual logout
    try {
      // Best-effort: revoke PIN bridge session if present
      try {
        const { pinLogout } = await import("@/lib/pin-bridge");
        await pinLogout();
      } catch {
        await supabase.auth.signOut();
      }
      console.log("[AuthContext] signOut successful");
    } catch (error) {
      console.error("[AuthContext] signOut error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role: profile?.role ?? null,
        schoolId: profile?.schoolId ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
