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

async function logSessionEvent(
  user: User | { id: string; app_metadata?: any; identities?: any },
  eventType: "LOGIN" | "LOGOUT"
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("log-session", {
      body: { user, event_type: eventType },
    });
    if (error) {
      console.warn(`Failed to log ${eventType} event via edge function:`, error);
    }
  } catch (err) {
    console.warn(`Error invoking log-session edge function:`, err);
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
  // Track whether we already logged a login for this session to avoid duplicates
  const loggedLoginRef = useRef<string | null>(null);
  const { toast } = useToast();
  const sessionExpiredShownRef = useRef(false);

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
        fetchProfile(s.user.id, s.user.email ?? null).then((p) => {
          setProfile(p);
          profileRef.current = p;
          setLoading(false);
          // Log login once per session id
          if (event === "SIGNED_IN" && loggedLoginRef.current !== s.access_token) {
            loggedLoginRef.current = s.access_token ?? null;
            sessionExpiredShownRef.current = false;
            logSessionEvent(s.user, "LOGIN");
          }
        });
      } else {
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
        
        // Log logout event on SIGNED_OUT using the cached user object
        if (event === "SIGNED_OUT") {
          if (currentUserRef.current) {
            logSessionEvent(currentUserRef.current, "LOGOUT");
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

    // Cross-tab session invalidation
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "supabase-auth-token" && e.newValue === null) {
        // Another tab logged out - clear local state
        setSession(null);
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        loggedLoginRef.current = null;
        currentUserRef.current = null;
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [toast]);

  const signOut = async () => {
    console.log("[AuthContext] signOut called");
    sessionExpiredShownRef.current = true; // Prevent showing expired toast on manual logout
    try {
      await supabase.auth.signOut();
      console.log("[AuthContext] Supabase signOut successful");
    } catch (error) {
      console.error("[AuthContext] Supabase signOut error:", error);
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
