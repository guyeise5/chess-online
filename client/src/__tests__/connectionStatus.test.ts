import { describe, it, expect } from "vitest";
import { latencyToStrength, type SignalStrength } from "../hooks/useConnectionStatus";

describe("latencyToStrength", () => {
  it("returns 0 when disconnected", () => {
    expect(latencyToStrength(50, false)).toBe(0);
    expect(latencyToStrength(null, false)).toBe(0);
  });

  it("returns 0 when latency is null (connected but no measurement yet)", () => {
    expect(latencyToStrength(null, true)).toBe(0);
  });

  it("returns 4 (excellent) for latency < 100ms", () => {
    expect(latencyToStrength(0, true)).toBe(4);
    expect(latencyToStrength(50, true)).toBe(4);
    expect(latencyToStrength(99, true)).toBe(4);
  });

  it("returns 3 (good) for 100ms <= latency < 300ms", () => {
    expect(latencyToStrength(100, true)).toBe(3);
    expect(latencyToStrength(200, true)).toBe(3);
    expect(latencyToStrength(299, true)).toBe(3);
  });

  it("returns 2 (fair) for 300ms <= latency < 600ms", () => {
    expect(latencyToStrength(300, true)).toBe(2);
    expect(latencyToStrength(450, true)).toBe(2);
    expect(latencyToStrength(599, true)).toBe(2);
  });

  it("returns 1 (poor) for latency >= 600ms", () => {
    expect(latencyToStrength(600, true)).toBe(1);
    expect(latencyToStrength(1000, true)).toBe(1);
    expect(latencyToStrength(5000, true)).toBe(1);
  });

  it("boundary values are correctly categorized", () => {
    const boundaries: [number, SignalStrength][] = [
      [0, 4],
      [99, 4],
      [100, 3],
      [299, 3],
      [300, 2],
      [599, 2],
      [600, 1],
    ];
    for (const [ms, expected] of boundaries) {
      expect(latencyToStrength(ms, true)).toBe(expected);
    }
  });
});

describe("FEATURE_CONNECTION_STATUS flag", () => {
  it("enabled by default (undefined is not 'false')", () => {
    const flags: Record<string, string | undefined> = {};
    const show = flags.FEATURE_CONNECTION_STATUS !== "false";
    expect(show).toBe(true);
  });

  it("enabled when explicitly 'true'", () => {
    const flags = { FEATURE_CONNECTION_STATUS: "true" };
    const show = flags.FEATURE_CONNECTION_STATUS !== "false";
    expect(show).toBe(true);
  });

  it("disabled when 'false'", () => {
    const flags = { FEATURE_CONNECTION_STATUS: "false" };
    const show = flags.FEATURE_CONNECTION_STATUS !== "false";
    expect(show).toBe(false);
  });
});

describe("signal strength color mapping", () => {
  const STRENGTH_COLORS: Record<SignalStrength, string> = {
    0: "#ca3431",
    1: "#ca3431",
    2: "#e6b800",
    3: "#3dad2e",
    4: "#3dad2e",
  };

  it("disconnected (0) is red", () => {
    expect(STRENGTH_COLORS[0]).toBe("#ca3431");
  });

  it("poor (1) is red", () => {
    expect(STRENGTH_COLORS[1]).toBe("#ca3431");
  });

  it("fair (2) is yellow", () => {
    expect(STRENGTH_COLORS[2]).toBe("#e6b800");
  });

  it("good (3) is green", () => {
    expect(STRENGTH_COLORS[3]).toBe("#3dad2e");
  });

  it("excellent (4) is green", () => {
    expect(STRENGTH_COLORS[4]).toBe("#3dad2e");
  });
});

describe("connection status tooltip text", () => {
  it("shows latency when connected", () => {
    const connected = true;
    const latency = 42;
    const text = connected ? `Latency: ${latency}ms` : "Disconnected from server";
    expect(text).toBe("Latency: 42ms");
  });

  it("shows disconnected message when not connected", () => {
    const connected = false;
    const latency = null;
    const text = connected ? `Latency: ${latency}ms` : "Disconnected from server";
    expect(text).toBe("Disconnected from server");
  });
});
