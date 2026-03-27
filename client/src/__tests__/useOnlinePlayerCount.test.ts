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
