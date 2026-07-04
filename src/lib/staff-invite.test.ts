import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import { buildStaffInviteLink, generateStaffInviteToken, validateStaffInviteToken } from "./staff-invite";

describe("staff invite helpers", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("builds a staff invite URL", () => {
    expect(buildStaffInviteLink("https://school.example", "demo-school", "invite-token")).toBe(
      "https://school.example/app/demo-school/login?invite_token=invite-token"
    );
  });

  it("requests a token from the RPC and returns it", async () => {
    rpcMock.mockResolvedValue({ data: [{ token: "secret-token", expires_at: "2026-06-20T00:00:00Z" }], error: null });

    const result = await generateStaffInviteToken("demo-school");

    expect(rpcMock).toHaveBeenCalledWith("generate_staff_invite_token", { _school_slug: "demo-school" });
    expect(result.token).toBe("secret-token");
    expect(result.expiresAt).toBe("2026-06-20T00:00:00Z");
  });

  it("validates an invite token and normalises the payload", async () => {
    rpcMock.mockResolvedValue({
      data: [{
        tenant_id: "tenant-123",
        school_name: "Bright Stars",
        status: "active",
        plan: "trial",
        subscription_ends_at: null,
        trial_started_at: null,
        session_token: "session-token",
      }],
      error: null,
    });

    const result = await validateStaffInviteToken("invite-token");

    expect(rpcMock).toHaveBeenCalledWith("validate_staff_invite_token", { _token: "invite-token" });
    expect(result).toMatchObject({
      tenantId: "tenant-123",
      schoolName: "Bright Stars",
      sessionToken: "session-token",
      status: "active",
    });
  });

  it("rejects empty invite tokens", async () => {
    await expect(validateStaffInviteToken(" ")).rejects.toThrow("Invite token is required");
  });
});
