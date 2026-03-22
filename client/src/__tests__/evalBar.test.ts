import { describe, it, expect } from "vitest";
import { evalWhitePercent, formatEvalLabel } from "../components/EvalBar";

describe("evalWhitePercent", () => {
  it("is 50 at score 0", () => {
    expect(evalWhitePercent(0)).toBe(50);
  });

  it("clamps to [4, 96]", () => {
    expect(evalWhitePercent(-1e9)).toBe(4);
    expect(evalWhitePercent(1e9)).toBe(96);
  });

  it("increases with positive score and decreases with negative", () => {
    expect(evalWhitePercent(200)).toBeGreaterThan(50);
    expect(evalWhitePercent(-200)).toBeLessThan(50);
  });
});

describe("formatEvalLabel", () => {
  it("formats centipawns as pawns with one decimal", () => {
    expect(formatEvalLabel(0)).toBe("0.0");
    expect(formatEvalLabel(123)).toBe("1.2");
    expect(formatEvalLabel(-456)).toBe("4.6");
  });

  it("shows # for checkmate (score 10000)", () => {
    expect(formatEvalLabel(10000)).toBe("#");
    expect(formatEvalLabel(-10000)).toBe("#");
  });

  it("shows mate distance for mate scores", () => {
    expect(formatEvalLabel(9999)).toBe("M1");
    expect(formatEvalLabel(-9999)).toBe("M1");
    expect(formatEvalLabel(9998)).toBe("M2");
    expect(formatEvalLabel(9995)).toBe("M5");
    expect(formatEvalLabel(-9900)).toBe("M100");
  });
});
