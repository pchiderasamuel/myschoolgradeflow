import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, User, Users, GraduationCap as StudentIcon } from "lucide-react";

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: "a-spin 0.8s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pin, setPin] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [role, setRole] = useState<'staff' | 'student' | null>(null);
  
  // Credentials state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // If already authenticated and session is valid, redirect to the appropriate portal
  useEffect(() => {
    if (authLoading || !user) return;
    
    // We can check the role from localStorage or from the context if needed.
    // Assuming local storage has the role set from previous login.
    const currentRole = localStorage.getItem("schoolapp_role");
    
    if (currentRole === "student") {
      navigate("/student", { replace: true });
    } else if (currentRole === "staff" || currentRole === "teacher") {
      navigate("/teacher", { replace: true });
    } else {
      navigate("/school", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc("validate_school_pin", { _pin: pin.trim().toUpperCase() });
      if (error || !data || data.length === 0) {
        toast({ title: "Invalid school PIN", description: "Check with your provider.", variant: "destructive" });
        return;
      }
      
      setTenantId(data[0].tenant_id);
      setSchoolId(data[0].school_id);
      setSchoolName(data[0].school_name);
      setStep(2);
    } catch (err) {
      toast({ title: "Error validating PIN", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (selectedRole: 'staff' | 'student') => {
    setRole(selectedRole);
    setStep(3);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const rpcName = role === 'staff' ? 'login_staff' : 'login_student';
      const rpcParams = role === 'staff'
        ? { _school_id: schoolId, _first_name: firstName.trim(), _last_name: lastName.trim() }
        : { _school_id: schoolId, _admission_no: admissionNo.trim() };

      const { data: lookup, error: lookupError } = await supabase.rpc(rpcName, rpcParams);

      if (lookupError || !lookup || lookup.length === 0) {
        toast({ title: "Invalid name or password", variant: "destructive" });
        return;
      }

      // Sign in with Supabase Auth using the returned internal email + entered password
      const internalEmail = lookup[0].email;
      const mustChangePassword = lookup[0].must_change_password;

      // Store tenant context using localStorage/sessionStorage BEFORE signing in
      // to avoid race conditions where AuthContext's onAuthStateChange fires
      // before these are set, causing premature sign-outs.
      localStorage.setItem("schoolapp_tenant_id", tenantId);
      localStorage.setItem("schoolapp_school_id", schoolId);
      localStorage.setItem("schoolapp_school_name", schoolName);
      // Map the login-step role to a valid AppRole.
      // 'staff' is the generic login selector — staff members are 'teacher' by default.
      // The actual granular role (principal, head_teacher, etc.) is on the staff.role column
      // and will be returned by the login_staff RPC once that column is included.
      const appRole = role === "student" ? "student" : "teacher";
      localStorage.setItem("schoolapp_role", appRole);
      localStorage.setItem("schoolapp_school_slug", schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: password,
      });

      if (authError || !authData.user) {
        // Rollback tenant context if login failed
        localStorage.removeItem("schoolapp_tenant_id");
        localStorage.removeItem("schoolapp_school_id");
        localStorage.removeItem("schoolapp_role");
        toast({ title: "Invalid name or password", variant: "destructive" });
        return;
      }

      // Redirect
      if (mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        if (role === "student") {
          navigate("/student", { replace: true });
        } else if (role === "staff" || role === "teacher") {
          navigate("/teacher", { replace: true });
        } else {
          navigate("/school", { replace: true });
        }
      }
    } catch (err) {
      toast({ title: "Sign-in failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />
      <div className="auth-dots" />

      {/* Floating ambient cards for extra trust/enterprise feel */}
      <div className="auth-float-card" style={{ top: "12%", left: "5%", animationDelay: "0s" }}>
        <div className="auth-float-card-icon" style={{ color: "#2563eb" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
        </div>
        <span>Grade Analytics</span>
      </div>
      <div className="auth-float-card" style={{ bottom: "15%", right: "4%", animationDelay: "1.5s" }}>
        <div className="auth-float-card-icon" style={{ color: "#059669" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span>End-to-End Secure</span>
      </div>

      <div className="auth-layout">
        <div className="auth-side">
          <div className="auth-side-tag">Cloud Management</div>
          <h1 className="auth-side-title">
            The modern way to run your <span>school.</span>
          </h1>
          <p className="auth-side-sub">
            Trusted by educational institutions to manage grades, attendance, and staff seamlessly. 
            All your data, synced and secured.
          </p>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#2563eb" }}>⚡</div>
              Offline-first technology
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#16a34a" }}>📊</div>
              Real-time synchronization
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon" style={{ color: "#8b5cf6" }}>🔒</div>
              Bank-grade PIN security
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-logo-ring">
            <GraduationCap size={28} color="#fff" strokeWidth={2} />
          </div>

          <div className="auth-steps">
            <div className={`auth-step-dot ${step >= 1 ? "on" : ""}`} />
            <div className={`auth-step-dot ${step >= 2 ? "on" : ""}`} />
            <div className={`auth-step-dot ${step >= 3 ? "on" : ""}`} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
            <h2 className="auth-title">
              {step === 1 && "School Login"}
              {step === 2 && "Select Your Role"}
              {step === 3 && "Enter Credentials"}
            </h2>
            {step > 1 && schoolName && (
              <span className="auth-badge">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
                Active
              </span>
            )}
          </div>

          <p className="auth-subtitle">
            {step === 1 && "Enter your school's unique access PIN to continue."}
            {step === 2 && <>Welcome to <strong>{schoolName}</strong>. Select your role to continue.</>}
            {step === 3 && <>Secure login for <strong>{schoolName}</strong></>}
          </p>

          <div style={{ marginTop: "1.75rem" }}>
            {step === 1 && (
              <form onSubmit={handlePinSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="auth-label" htmlFor="schoolPin">School PIN</label>
                  <input
                    id="schoolPin" className="auth-input" type="text" inputMode="text"
                    value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())}
                    placeholder="e.g. SCH-7K2P" required autoFocus
                    style={{ letterSpacing: pin ? "0.1em" : "normal", fontWeight: pin ? 600 : 400 }}
                  />
                  <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#64748b" }}>
                    Issued by your provider on subscription.
                  </p>
                </div>

                <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: "0.5rem" }}>
                  {loading ? <><Spinner /> Verifying…</> : <>Continue</>}
                </button>

                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">service provider?</span>
                  <div className="auth-divider-line" />
                </div>
                <div style={{ textAlign: "center" }}>
                  <button type="button" className="auth-link-btn" onClick={() => navigate("/admin/login")}>
                    Provider sign-in &rarr;
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <button
                  type="button"
                  onClick={() => handleRoleSelect("staff")}
                  className="auth-btn"
                  style={{ 
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    padding: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    justifyContent: "flex-start"
                  }}
                >
                  <div style={{ background: "rgba(255,255,255,0.2)", padding: "0.75rem", borderRadius: "0.5rem" }}>
                    <Users size={24} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "1rem" }}>Staff</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>Teachers & School Administrators</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect("student")}
                  className="auth-btn"
                  style={{ 
                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    padding: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    justifyContent: "flex-start"
                  }}
                >
                  <div style={{ background: "rgba(255,255,255,0.2)", padding: "0.75rem", borderRadius: "0.5rem" }}>
                    <StudentIcon size={24} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: "1rem" }}>Student</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>View timetable, results, attendance</div>
                  </div>
                </button>

                <button type="button" className="auth-back-link" style={{ justifyContent: "center", marginTop: "0.5rem" }}
                  onClick={() => { setStep(1); setPin(""); }}>
                  &larr; Use a different school PIN
                </button>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleCredentialsSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {role === 'staff' ? (
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <label className="auth-label" htmlFor="firstName">First name</label>
                      <input
                        id="firstName" className="auth-input" type="text"
                        value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. John" required autoFocus
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="auth-label" htmlFor="lastName">Last name</label>
                      <input
                        id="lastName" className="auth-input" type="text"
                        value={lastName} onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Doe" required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="auth-label" htmlFor="admissionNo">Your admission number</label>
                    <input
                      id="admissionNo" className="auth-input" type="text"
                      value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)}
                      placeholder="e.g. ADM12345" required autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="auth-label" htmlFor="password">Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password" className="auth-input"
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

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? <><Spinner /> Signing in…</> : <>Sign In</>}
                </button>

                <button type="button" className="auth-back-link" style={{ justifyContent: "center", marginBottom: 0 }}
                  onClick={() => setStep(2)}>
                  &larr; Back to Role Selection
                </button>
              </form>
            )}
          </div>

          <div style={{ marginTop: "1.75rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Powered by <strong style={{ color: "#64748b" }}>Titbeattechsolutions LTD</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
