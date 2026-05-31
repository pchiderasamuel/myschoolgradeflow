import { describe, it, expect, vi } from "vitest";

describe("Environment variable validation", () => {
  it("should load ENV correctly", async () => {
    // Dynamically import to ensure environment variables are evaluated during the test
    const { ENV } = await import("../utils/env");
    expect(ENV.VITE_SUPABASE_URL).toBeDefined();
    expect(ENV.VITE_SUPABASE_ANON_KEY).toBeDefined();
  });
});
