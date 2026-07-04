import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { normalizeRole } from "@/lib/auth-role";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: "a-spin 0.8s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth();

  // Still resolving auth state — show spinner regardless
  if (loading) return <Spinner />;

  // No session at all — send to login
  if (!session) return <Navigate to="/auth" replace />;

  // role === null means profile fetch is still in-flight or pending.
  // We should NOT redirect here; the component above us controls loading.
  // Only "unassigned" (explicitly resolved with no valid role) triggers a redirect.
  if (role === "unassigned") return <Navigate to="/unauthorized" replace />;

  const normalizedRole = normalizeRole(role);
  if (allowedRoles && normalizedRole && !allowedRoles.includes(normalizedRole as AppRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
