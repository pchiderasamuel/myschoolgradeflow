import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { insertSessionLog, getUserRole, checkUserRole, getUserProfile } from "@/supabase/schoolService";
import { useToast } from "@/hooks/use-toast";

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
  // First try fetching from public.profiles (Phase 2 table)
  const profileRow = await getUserProfile(userId);
  
  if (profileRow) {
    return {
      userId,
      email,
      role: (profileRow.role as AppRole) ?? "unassigned",
      schoolId: profileRow.school_id ?? null,
      firstName: profileRow.first_name ?? null,
      lastName: profileRow.last_name ?? null,
    };
  }

  // Fallback: check user_roles table (super_admin bootstrap path)
  const isSuperAdmin = await checkUserRole(userId, "super_admin");
  if (isSuperAdmin) {
    return { userId, email, role: "super_admin", schoolId: null, firstName: null, lastName: null };
  }

  return { userId, email, role: "unassigned", schoolId: null, firstName: null, lastName: null };
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
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        currentUserRef.current = s.user;
        fetchProfile(s.user.id, s.user.email ?? null).then((p) => {
          setProfile(p);
          profileRef.current = p;
          setLoading(false);
        });
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
            setProfile(p);
            profileRef.current = p;
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
                logSessionEvent(s.user, "LOGIN", p);
              }
            }
          })
          .catch((err) => {
            console.error("[AuthContext] Failed to fetch profile:", err);
            // Fallback to unassigned role to keep app functional
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
