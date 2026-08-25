import { describe, it, expect, vi } from "vitest";

describe("Promotion Custom Events & Wire Listeners", () => {
  it("should trigger open-promotion-history listener when window custom event is dispatched", () => {
    const listener = vi.fn();
    window.addEventListener("open-promotion-history", listener);

    window.dispatchEvent(new CustomEvent("open-promotion-history"));

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("open-promotion-history", listener);
  });

  it("should trigger open-promotion-wizard listener when window custom event is dispatched", () => {
    const listener = vi.fn();
    window.addEventListener("open-promotion-wizard", listener);

    window.dispatchEvent(new CustomEvent("open-promotion-wizard"));

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("open-promotion-wizard", listener);
  });
});
