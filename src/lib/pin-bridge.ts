// PIN→Supabase auth bridge helpers.
// Each function: (1) calls the RPC to mint a one-time bridge token,
// (2) trades it via the `bridge-pin-login` edge function for a real
// Supabase session, (3) installs the session on the local client.
import { supabase } from "@/integrations/supabase/client";

export interface BridgeResult {
  role: "school_admin" | "teacher" | "student";
  schoolId: string;
  pinSessionToken: string;
  subjectKind: "admin" | "teacher" | "student";
  subjectId: string | null;
}

const LS_KEY = "pin_bridge_session";

interface StoredBridge extends BridgeResult {
  loggedInAt: number;
}

export function loadBridgeSession(): StoredBridge | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredBridge) : null;
  } catch {
    return null;
  }
}

export function clearBridgeSession() {
  localStorage.removeItem(LS_KEY);
}

async function exchange(bridgeToken: string): Promise<BridgeResult> {
  const device =
    typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const { data, error } = await supabase.functions.invoke(
    "bridge-pin-login",
    { body: { bridgeToken, device } },
  );
  if (error) throw new Error(error.message ?? "Bridge exchange failed");
  if (!data || typeof data !== "object" || !("access_token" in data)) {
    throw new Error((data as { error?: string })?.error ?? "Bridge failed");
  }

  const payload = data as {
    access_token: string;
    refresh_token: string;
    role: BridgeResult["role"];
    schoolId: string;
    pinSessionToken: string;
    subjectKind: BridgeResult["subjectKind"];
    subjectId: string | null;
  };

  const setSess = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (setSess.error) throw setSess.error;

  const result: BridgeResult = {
    role: payload.role,
    schoolId: payload.schoolId,
    pinSessionToken: payload.pinSessionToken,
    subjectKind: payload.subjectKind,
    subjectId: payload.subjectId,
  };
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({ ...result, loggedInAt: Date.now() } satisfies StoredBridge),
  );
  return result;
}

export async function bridgeAdminPin(
  schoolPin: string,
  adminPin: string,
): Promise<BridgeResult> {
  const { data, error } = await supabase.rpc("bridge_admin_pin", {
    _school_pin: schoolPin,
    _admin_pin: adminPin,
  });
  if (error || !data) throw new Error(error?.message ?? "Invalid PIN");
  return exchange(data as string);
}

export async function bridgeTeacherPin(
  schoolPin: string,
  employeeId: string,
  teacherPin: string,
): Promise<BridgeResult> {
  const { data, error } = await supabase.rpc("bridge_teacher_pin", {
    _school_pin: schoolPin,
    _employee_id: employeeId,
    _teacher_pin: teacherPin,
  });
  if (error || !data) throw new Error(error?.message ?? "Invalid credentials");
  return exchange(data as string);
}

export async function bridgeStudentPin(
  schoolPin: string,
  admissionNo: string,
  studentPin: string,
): Promise<BridgeResult> {
  const { data, error } = await supabase.rpc("bridge_student_pin", {
    _school_pin: schoolPin,
    _admission_no: admissionNo,
    _student_pin: studentPin,
  });
  if (error || !data) throw new Error(error?.message ?? "Invalid credentials");
  return exchange(data as string);
}

export async function pinLogout(): Promise<void> {
  const stored = loadBridgeSession();
  if (stored?.pinSessionToken) {
    try {
      await supabase.rpc("pin_logout", {
        _session_token: stored.pinSessionToken,
      });
    } catch {
      /* ignore — session sign-out is best-effort */
    }
  }
  clearBridgeSession();
  await supabase.auth.signOut();
}

export function routeForRole(role: BridgeResult["role"]): string {
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  return "/school";
}
