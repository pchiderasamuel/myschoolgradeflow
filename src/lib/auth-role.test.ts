import { describe, expect, it } from "vitest";
import { getEffectiveRole, normalizeRole } from "./auth-role";

describe("normalizeRole", () => {
  it("maps legacy superadmin values to super_admin", () => {
    expect(normalizeRole("superadmin")).toBe("super_admin");
    expect(normalizeRole("SuperAdmin")).toBe("super_admin");
  });

  it("maps school admin aliases to school_admin", () => {
    expect(normalizeRole("admin")).toBe("school_admin");
    expect(normalizeRole("school_admin")).toBe("school_admin");
  });

  it("maps staff aliases to the expected app roles", () => {
    expect(normalizeRole("authorised_staff")).toBe("authorised_staff");
    expect(normalizeRole("staff")).toBe("authorised_staff");
    expect(normalizeRole("headteacher")).toBe("head_teacher");
    expect(normalizeRole("principal")).toBe("principal");
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole("" )).toBeNull();
    expect(normalizeRole("unknown-role")).toBeNull();
  });

  it("uses bridge role as a fallback when the profile role is unresolved", () => {
    expect(getEffectiveRole("unassigned", "school_admin")).toBe("school_admin");
    expect(getEffectiveRole(null, "teacher")).toBe("teacher");
    expect(getEffectiveRole(undefined, "student")).toBe("student");
  });
});
