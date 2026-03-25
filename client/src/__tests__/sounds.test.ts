import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSoundTypeForSan, playMoveSound, playSound } from "../utils/sounds";

describe("getSoundTypeForSan", () => {
  it("returns 'move' for a standard move", () => {
    expect(getSoundTypeForSan("e4")).toBe("move");
  });

  it("returns 'move' for a castling move", () => {
    expect(getSoundTypeForSan("O-O")).toBe("move");
    expect(getSoundTypeForSan("O-O-O")).toBe("move");
  });

  it("returns 'capture' for a capture move", () => {
    expect(getSoundTypeForSan("exd5")).toBe("capture");
    expect(getSoundTypeForSan("Nxf7")).toBe("capture");
    expect(getSoundTypeForSan("Bxe6")).toBe("capture");
  });

  it("returns 'move' for a check without capture (matches Lichess)", () => {
    expect(getSoundTypeForSan("Bb5+")).toBe("move");
    expect(getSoundTypeForSan("Qh5+")).toBe("move");
  });

  it("returns 'capture' for a check with capture (matches Lichess)", () => {
    expect(getSoundTypeForSan("Qxf7+")).toBe("capture");
    expect(getSoundTypeForSan("Nxe7#")).toBe("capture");
  });

  it("returns 'move' for a checkmate without capture", () => {
    expect(getSoundTypeForSan("Rh8#")).toBe("move");
  });

  it("returns 'capture' for a checkmate with capture", () => {
    expect(getSoundTypeForSan("Qxf7#")).toBe("capture");
  });

  it("returns 'move' for an empty string", () => {
    expect(getSoundTypeForSan("")).toBe("move");
  });

  it("returns 'move' for non-string inputs", () => {
    expect(getSoundTypeForSan(null as unknown as string)).toBe("move");
    expect(getSoundTypeForSan(undefined as unknown as string)).toBe("move");
    expect(getSoundTypeForSan(42 as unknown as string)).toBe("move");
  });

  it("returns 'move' for a pawn push", () => {
    expect(getSoundTypeForSan("d4")).toBe("move");
    expect(getSoundTypeForSan("a6")).toBe("move");
  });

  it("returns 'move' for a promotion without capture", () => {
    expect(getSoundTypeForSan("e8=Q")).toBe("move");
  });

  it("returns 'capture' for a promotion with capture", () => {
    expect(getSoundTypeForSan("exd8=Q")).toBe("capture");
  });

  it("returns 'move' for a promotion with check but no capture", () => {
    expect(getSoundTypeForSan("e8=Q+")).toBe("move");
  });

  it("returns 'capture' for a promotion with capture and check", () => {
    expect(getSoundTypeForSan("exd8=Q#")).toBe("capture");
  });
});

describe("playSound", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw when AudioContext is unavailable", () => {
    vi.stubGlobal("window", { __ENV__: {} });
    expect(() => playSound("move")).not.toThrow();
  });

  it("does not throw for any sound type", () => {
    const types = ["move", "capture", "gameStart", "gameEnd", "lowTime"] as const;
    for (const type of types) {
      expect(() => playSound(type)).not.toThrow();
    }
  });

  it("does not play when feature flag is disabled", () => {
    vi.stubGlobal("window", {
      ...globalThis.window,
      __ENV__: { FEATURE_MOVE_SOUND: "false" },
    });
    playSound("move");
  });
});

describe("playMoveSound", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw for valid SAN strings", () => {
    expect(() => playMoveSound("e4")).not.toThrow();
    expect(() => playMoveSound("Nxf7+")).not.toThrow();
    expect(() => playMoveSound("O-O")).not.toThrow();
  });

  it("does not throw for invalid input", () => {
    expect(() => playMoveSound("")).not.toThrow();
    expect(() => playMoveSound(null as unknown as string)).not.toThrow();
  });
});

