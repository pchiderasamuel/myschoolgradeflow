import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { logAuthEvent } from "@/lib/auth-logger";
import { normalizeRole } from "@/lib/auth-role";
import { saveTenantSession, type TenantSession } from "@/lib/tenant-client";
import { validateStaffInviteToken } from "@/lib/staff-invite";
import { GraduationCap, Loader2 } from "lucide-react";

interface TenantInfo {
  tenant_id: string;
  school_name: string;
  status: string;
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: "a-spin 0.8s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function StaffLogin() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [resolving, setResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Resolve slug → tenant info
  useEffect(() => {
    if (!schoolSlug) {
      setNotFound(true);
      setResolving(false);
      return;
    }

    (async () => {
      setResolving(true);
      try {
        const { data, error } = await supabase.rpc("get_tenant_by_slug", { _slug: schoolSlug });
        if (error || !data || data.length === 0) {
          setNotFound(true);
        } else {
          setTenantInfo(data[0] as TenantInfo);
          // Persist the slug so sign-out can redirect back here
          localStorage.setItem("schoolapp_school_slug", schoolSlug);
          localStorage.setItem("schoolapp_school_id", (data[0] as TenantInfo).tenant_id);
        }
      } catch {
        setNotFound(true);
      } finally {
        setResolving(false);
      }
    })();
  }, [schoolSlug]);

  useEffect(() => {
    const token = searchParams.get("invite_token");
    if (token) {
      setInviteToken(token);
      (async () => {
        try {
          const data = await validateStaffInviteToken(token);
          const sessionPayload: TenantSession = {
            tenantId: data.tenantId,
            schoolName: data.schoolName,
            slug: schoolSlug ?? "",
            sessionToken: data.sessionToken,
            status: data.status as TenantSession["status"],
            plan: data.plan as TenantSession["plan"],
            subscriptionEndsAt: data.subscriptionEndsAt,
            trialStartedAt: data.trialStartedAt,
            isAdmin: true,
            hasAdminPin: false,
            role: "admin",
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          };
          saveTenantSession(sessionPayload);
          await logAuthEvent({ authType: "staff", eventType: "login", tenantId: data.tenantId, sessionToken: data.sessionToken });
          navigate("/app", { replace: true });
        } catch (error) {
          toast({ title: "Invalid invite link", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
        }
      })();
    }
  }, [navigate, schoolSlug, searchParams]);

  // If already authenticated, redirect to role-based dashboard
  useEffect(() => {
    if (authLoading || resolving || !user || !profile) return;
    redirectByRole(profile.role);
  }, [authLoading, resolving, user, profile]); // eslint-disable-line

  const redirectByRole = (role: string | null | undefined) => {
    const normalized = normalizeRole(role);
    if (normalized === "student") navigate("/student", { replace: true });
    else if (["school_admin", "principal", "head_teacher", "authorised_staff"].includes(normalized ?? ""))
      navigate("/school", { replace: true });
    else if (normalized === "teacher") navigate("/teacher", { replace: true });
    else if (normalized === "super_admin") navigate("/superadmin", { replace: true });
    else navigate("/unauthorized", { replace: true }); // explicit: unassigned gets denied
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        // Do NOT redirect here. The useEffect above watches AuthContext.profile and
        // will redirect once the role is fully resolved. Doing it here races against
        // AuthContext.fetchProfile and can cause a second redirect with a stale role.
        await logAuthEvent({
          authType: "staff",
          eventType: "login",
          userId: data.user.id,
        });
        // setLoading stays true — the spinner shows while AuthContext resolves
      }
    } catch (err) {
      toast({ title: "Sign-in failed", description: (err as Error).message, variant: "destructive" });
      setLoading(false); // Only clear loading on error; success stays loading until redirect
    }
  };

  // Loading state
  if (resolving) {
    return (
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-dots" />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
          <Loader2 size={20} style={{ animation: "a-spin 0.8s linear infinite" }} />
          <span>Loading school...</span>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound || !tenantInfo) {
    return (
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-dots" />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-logo-ring" style={{ margin: "0 auto 1.25rem", background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
            <GraduationCap size={28} color="#fff" strokeWidth={2} />
          </div>
          <h2 className="auth-title">School Not Found</h2>
          <p className="auth-subtitle" style={{ marginTop: "0.5rem" }}>
            The link you followed doesn't match any school. Check the URL or ask your admin for the correct link.
          </p>
          <button className="auth-btn" onClick={() => navigate("/")} style={{ marginTop: "1.5rem" }}>
            Go to School PIN Entry
          </button>
        </div>
      </div>
    );
  }

  // Suspended / expired
  if (tenantInfo.status === "suspended" || tenantInfo.status === "expired") {
    return (
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-dots" />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-logo-ring" style={{ margin: "0 auto 1.25rem", background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <GraduationCap size={28} color="#fff" strokeWidth={2} />
          </div>
          <h2 className="auth-title">
            {tenantInfo.status === "suspended" ? "Account Suspended" : "Subscription Expired"}
          </h2>
          <p className="auth-subtitle" style={{ marginTop: "0.5rem" }}>
            <strong>{tenantInfo.school_name}</strong>'s account is currently {tenantInfo.status}. Please contact your school admin or provider.
          </p>
        </div>
      </div>
    );
  }

  // If already logged in and redirecting
  if (user && !authLoading) {
    return (
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-dots" />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b" }}>
          <Loader2 size={20} style={{ animation: "a-spin 0.8s linear infinite" }} />
          <span>Redirecting...</span>
        </div>
      </div>
    );
  }

  // Staff login form
  return (
    <div className="auth-bg">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />
      <div className="auth-dots" />

      <div className="auth-float-card" style={{ top: "12%", left: "5%", animationDelay: "0s" }}>
        <div className="auth-float-card-icon" style={{ color: "#2563eb" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4" /></svg>
        </div>
        <span>Grade Analytics</span>
      </div>
      <div className="auth-float-card" style={{ bottom: "15%", right: "4%", animationDelay: "1.5s" }}>
        <div className="auth-float-card-icon" style={{ color: "#059669" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span>End-to-End Secure</span>
      </div>

      <div className="auth-layout">
        <div className="auth-side">
          <div className="auth-side-tag">Staff Portal</div>
          <h1 className="auth-side-title">
            Welcome to <span>{tenantInfo.school_name}</span>
          </h1>
          <p className="auth-side-sub">
            Sign in with your staff credentials to access the school management platform.
            Your school admin has shared this link — no school PIN required.
          </p>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#2563eb" }}>⚡</div>
              Direct staff access — no PIN needed
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#16a34a" }}>📊</div>
              Real-time synchronization
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#8b5cf6" }}>🔒</div>
              Secure credential-based login
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-logo-ring">
            <GraduationCap size={28} color="#fff" strokeWidth={2} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
            <h2 className="auth-title">Staff Login</h2>
            <span className="auth-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
              {tenantInfo.school_name}
            </span>
          </div>

          <p className="auth-subtitle">
            Sign in with your staff email and password for <strong>{tenantInfo.school_name}</strong>.
          </p>

          <form onSubmit={handleLogin} style={{ marginTop: "1.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="auth-label" htmlFor="staffEmail">Email Address</label>
              <input
                id="staffEmail" className="auth-input" type="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.com" required autoFocus
              />
            </div>

            <div>
              <label className="auth-label" htmlFor="staffPassword">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="staffPassword" className="auth-input"
                  type={showPass ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: "0.5rem" }}>
              {loading ? <><Spinner /> Signing in…</> : <>Sign In</>}
            </button>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>
            <div style={{ textAlign: "center" }}>
              <button type="button" className="auth-link-btn" onClick={() => navigate("/")}>
                Enter with school PIN instead &rarr;
              </button>
            </div>
          </form>

          <div style={{ marginTop: "1.75rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Powered by <strong style={{ color: "#64748b" }}>TitbeattechsolutionsLLC</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
