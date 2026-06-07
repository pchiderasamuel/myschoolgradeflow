// Tenant-scoped data + PIN auth helpers for the school app.
// PIN hashing happens SERVER-SIDE (bcrypt). Client sends plain PIN over HTTPS to SECURITY DEFINER RPCs.
// After verification, the server returns a short-lived session token used for all subsequent calls.

import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "schoolapp_tenant_session_v2";
const SLUG_KEY = "schoolapp_school_slug";
const SCHOOL_ID_KEY = "schoolapp_school_id";

export interface TenantSession {
  tenantId: string;
  schoolName: string;
  slug: string;
  sessionToken: string;
  status: "trial" | "active" | "expired" | "suspended";
  plan: "trial" | "termly" | "yearly";
  subscriptionEndsAt: string | null;
  trialStartedAt: string | null;
  isAdmin: boolean;
  hasAdminPin: boolean;
  role: "admin" | "teacher" | "student";
  expiresAt: string;
}

export function loadTenantSession(): TenantSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTenantSession(s: TenantSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  // Persist slug + schoolId to localStorage so sign-out can redirect back
  if (s.slug) {
    localStorage.setItem(SLUG_KEY, s.slug);
    localStorage.setItem("school_slug", s.slug);
  }
  if (s.tenantId) localStorage.setItem(SCHOOL_ID_KEY, s.tenantId);
}

export function clearTenantSession() {
  sessionStorage.removeItem(SESSION_KEY);
  // NOTE: We intentionally do NOT clear SLUG_KEY or SCHOOL_ID_KEY from localStorage
  // so sign-out can redirect back to the school-branded login screen.
}

/** Get the persisted school slug (survives sign-out). */
export function getSchoolSlug(): string | null {
  return localStorage.getItem(SLUG_KEY) || localStorage.getItem("school_slug");
}

/** Fully clear all school identity (used when switching schools). */
export function clearSchoolIdentity() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SLUG_KEY);
  localStorage.removeItem("school_slug");
  localStorage.removeItem(SCHOOL_ID_KEY);
}

/**
 * Verify school PIN.
 * - Returns the session info on success.
 * - Returns `null` when the PIN is valid format but doesn't match any school.
 * - THROWS on network / RPC errors so the caller can show a real message
 *   instead of misreporting a transient failure as "Invalid PIN".
 */
export async function verifySchoolPin(pin: string): Promise<Omit<TenantSession, "isAdmin"> | null> {
  const trimmed = pin.trim();
  if (!trimmed) return null;

  let data: any;
  let error: any;
  try {
    ({ data, error } = await supabase.rpc("verify_school_pin_v2", { _pin: trimmed }));
  } catch (e) {
    // Network failure ("Failed to fetch"), DNS, CORS, etc.
    throw new Error(
      e instanceof Error && e.message
        ? `Network error: ${e.message}`
        : "Network error — please check your connection and try again."
    );
  }
  if (error) {
    throw new Error(error.message || "Could not verify school PIN. Please try again.");
  }
  if (!data || data.length === 0) return null;

  const row = data[0];

  if (row.slug) {
    localStorage.setItem("school_slug", row.slug);
  }

  return {
    tenantId: row.tenant_id,
    schoolName: row.school_name,
    slug: row.slug ?? "",
    sessionToken: row.session_token,
    status: row.status,
    plan: row.plan,
    subscriptionEndsAt: row.subscription_ends_at,
    trialStartedAt: row.trial_started_at,
    hasAdminPin: row.has_admin_pin,
    role: "student" as const,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

export async function verifyAdminPin(session: TenantSession, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_admin_pin_v2", {
    _session_token: session.sessionToken,
    _pin: pin,
  });
  return !error && data === true;
}

/** First-time admin PIN setup — only succeeds if no admin pin set yet. */
export async function setAdminPin(session: TenantSession, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_admin_pin_v2", {
    _session_token: session.sessionToken,
    _pin: pin,
  });
  return !error && data === true;
}

export async function fetchTenantData(session: TenantSession): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc("get_tenant_data_v2", {
    _session_token: session.sessionToken,
  });
  if (error) return null;
  return (data as Record<string, unknown>) ?? {};
}

export async function saveTenantData(session: TenantSession, data: unknown): Promise<boolean> {
  const { data: ok, error } = await supabase.rpc("save_tenant_data_v2", {
    _session_token: session.sessionToken,
    _data: data as never,
  });
  return !error && ok === true;
}

/** Days remaining on trial or subscription (negative if expired). */
export function daysRemaining(session: TenantSession): number | null {
  const end = session.subscriptionEndsAt
    ? new Date(session.subscriptionEndsAt)
    : session.status === "trial" && session.trialStartedAt
      ? new Date(new Date(session.trialStartedAt).getTime() + 7 * 86400_000)
      : null;
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400_000);
}

/** Check if PIN session has expired (8-hour expiry). */
export function isSessionExpired(session: TenantSession): boolean {
  return new Date(session.expiresAt) < new Date();
}

/**
 * @deprecated PIN session login/logout is already recorded server-side by the
 * bridge-pin-login edge function and `pin_logout` RPC, which insert correctly
 * shaped rows into session_logs. This client-side helper inserted columns that
 * don't exist on session_logs and is intentionally a no-op.
 */
export async function logPinSessionEvent(
  _session: TenantSession,
  _eventType: "LOGIN" | "LOGOUT",
  _role: "admin" | "teacher" | "student"
): Promise<void> {
  return;
}
