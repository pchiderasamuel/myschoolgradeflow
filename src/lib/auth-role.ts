export type NormalizedAppRole =
  | "super_admin"
  | "school_admin"
  | "authorised_staff"
  | "principal"
  | "head_teacher"
  | "teacher"
  | "student";

const ROLE_ALIASES: Record<string, NormalizedAppRole> = {
  super_admin: "super_admin",
  superadmin: "super_admin",
  admin: "school_admin",
  school_admin: "school_admin",
  schooladmin: "school_admin",
  authorised_staff: "authorised_staff",
  staff: "authorised_staff",
  teacher: "teacher",
  principal: "principal",
  head_teacher: "head_teacher",
  headteacher: "head_teacher",
  student: "student",
};

export function normalizeRole(role: string | null | undefined): NormalizedAppRole | null {
  if (typeof role !== "string") return null;
  const value = role.trim().toLowerCase();
  if (!value) return null;
  return ROLE_ALIASES[value] ?? null;
}

export function getEffectiveRole(
  profileRole: string | null | undefined,
  bridgeRole?: string | null,
): NormalizedAppRole | null {
  const normalizedProfileRole = normalizeRole(profileRole);
  if (normalizedProfileRole) return normalizedProfileRole;

  if (typeof bridgeRole === "string" && bridgeRole.trim()) {
    return normalizeRole(bridgeRole);
  }

  return null;
}
