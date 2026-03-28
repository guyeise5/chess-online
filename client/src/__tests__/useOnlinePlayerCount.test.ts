import { describe, it, expect } from "vitest";
import { parseOnlineCountPayload } from "../hooks/useOnlinePlayerCount";

describe("parseOnlineCountPayload", () => {
  it("returns null for non-objects", () => {
    expect(parseOnlineCountPayload(null)).toBe(null);
    expect(parseOnlineCountPayload(undefined)).toBe(null);
    expect(parseOnlineCountPayload("x")).toBe(null);
    expect(parseOnlineCountPayload([])).toBe(null);
  });

  it("returns null when count is missing or not a finite number", () => {
    expect(parseOnlineCountPayload({})).toBe(null);
    expect(parseOnlineCountPayload({ count: "3" })).toBe(null);
    expect(parseOnlineCountPayload({ count: NaN })).toBe(null);
    expect(parseOnlineCountPayload({ count: Infinity })).toBe(null);
  });

  it("returns floored non-negative integers", () => {
    expect(parseOnlineCountPayload({ count: 0 })).toBe(0);
    expect(parseOnlineCountPayload({ count: 7 })).toBe(7);
    expect(parseOnlineCountPayload({ count: 2.9 })).toBe(2);
    expect(parseOnlineCountPayload({ count: -3 })).toBe(0);
  });
});

describe("online indicator stale state", () => {
  function indicatorState(count: number | null) {
    const isStale = count === null;
    const dotClass = isStale ? "onlineDotStale" : "onlineDot";
    const displayText = count !== null ? String(count) : "—";
    return { isStale, dotClass, displayText };
  }

  it("shows stale yellow dot when count is null (not yet received)", () => {
    const state = indicatorState(null);
    expect(state.isStale).toBe(true);
    expect(state.dotClass).toBe("onlineDotStale");
    expect(state.displayText).toBe("—");
  });

  it("shows green dot when count is received", () => {
    const state = indicatorState(5);
    expect(state.isStale).toBe(false);
    expect(state.dotClass).toBe("onlineDot");
    expect(state.displayText).toBe("5");
  });

  it("shows green dot even for zero count", () => {
    const state = indicatorState(0);
    expect(state.isStale).toBe(false);
    expect(state.dotClass).toBe("onlineDot");
    expect(state.displayText).toBe("0");
  });
});
