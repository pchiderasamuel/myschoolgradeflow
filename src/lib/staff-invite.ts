import { supabase } from "@/integrations/supabase/client";

export interface GeneratedInviteToken {
  token: string;
  expiresAt: string;
}

export interface InviteSessionData {
  tenantId: string;
  schoolName: string;
  status: string;
  plan: string;
  subscriptionEndsAt: string | null;
  trialStartedAt: string | null;
  sessionToken: string;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function generateStaffInviteToken(schoolSlug: string): Promise<GeneratedInviteToken> {
  const slug = schoolSlug.trim();
  if (!slug) {
    throw new Error("School slug is required");
  }

  const { data, error } = await supabase.rpc("generate_staff_invite_token", { _school_slug: slug });
  if (error) {
    throw new Error(error.message || "Failed to generate staff invite link");
  }

  const row = Array.isArray(data) ? data[0] : null;
  const token = readString(row?.token);
  const expiresAt = readString(row?.expires_at) ?? readString(row?.expiresAt);

  if (!token || !expiresAt) {
    throw new Error("The invite link could not be generated");
  }

  return {
    token,
    expiresAt,
  };
}

export function buildStaffInviteLink(baseOrigin: string | undefined, schoolSlug: string, token: string): string {
  const slug = schoolSlug.trim();
  if (!slug) {
    throw new Error("School slug is required");
  }

  const origin = baseOrigin?.trim() || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  return `${origin.replace(/\/$/, "")}/app/${encodeURIComponent(slug)}/login?invite_token=${encodeURIComponent(token)}`;
}

export async function validateStaffInviteToken(token: string): Promise<InviteSessionData> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Invite token is required");
  }

  const { data, error } = await supabase.rpc("validate_staff_invite_token", { _token: trimmed });
  if (error) {
    throw new Error(error.message || "Invalid or expired invite link");
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    throw new Error("Invalid invite link");
  }

  return {
    tenantId: readString(row.tenant_id) || "",
    schoolName: readString(row.school_name) || "Unknown school",
    status: readString(row.status) || "active",
    plan: readString(row.plan) || "trial",
    subscriptionEndsAt: readString(row.subscription_ends_at),
    trialStartedAt: readString(row.trial_started_at),
    sessionToken: readString(row.session_token) || "",
  };
}
