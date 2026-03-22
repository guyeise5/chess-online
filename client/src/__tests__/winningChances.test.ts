import { describe, it, expect } from "vitest";
import { winningChances } from "../hooks/useStockfishAnalysis";

/**
 * parseInfoEval-equivalent logic used to verify depth handling.
 * In the real hook, the listener accepts evals at ANY depth (highest wins),
 * so forced-mate positions that finish at depth < ANALYSIS_DEPTH still get scored.
 */
function simulateBestEval(
  infoLines: { depth: number; whiteCp: number }[]
): number {
  let bestEval: { depth: number; whiteCp: number } | null = null;
  for (const parsed of infoLines) {
    if (!bestEval || parsed.depth >= bestEval.depth) {
      bestEval = parsed;
    }
  }
  return bestEval?.whiteCp ?? 0;
}

function classifyDelta(delta: number) {
  if (delta > 0.4) return "blunder";
  if (delta > 0.2) return "mistake";
  if (delta > 0.1) return "inaccuracy";
  if (delta <= 0.04) return "best";
  return "good";
}

function wcDelta(
  cpBefore: number,
  cpAfter: number,
  whiteToMoveBefore: boolean
): number {
  const wcBefore = winningChances(cpBefore);
  const wcAfter = winningChances(cpAfter);
  const raw = whiteToMoveBefore
    ? wcBefore - wcAfter
    : wcAfter - wcBefore;
  return Math.max(0, raw);
}

describe("winningChances function", () => {
  it("returns 0 for an equal position (0 cp)", () => {
    expect(winningChances(0)).toBeCloseTo(0, 5);
  });

  it("returns positive value for white advantage", () => {
    expect(winningChances(100)).toBeGreaterThan(0);
    expect(winningChances(300)).toBeGreaterThan(winningChances(100));
  });

  it("returns negative value for black advantage", () => {
    expect(winningChances(-100)).toBeLessThan(0);
    expect(winningChances(-300)).toBeLessThan(winningChances(-100));
  });

  it("is symmetric: wc(cp) = -wc(-cp)", () => {
    expect(winningChances(200)).toBeCloseTo(-winningChances(-200), 10);
    expect(winningChances(500)).toBeCloseTo(-winningChances(-500), 10);
  });

  it("approaches +1 for large white advantage", () => {
    expect(winningChances(2000)).toBeGreaterThan(0.99);
  });

  it("approaches -1 for large black advantage", () => {
    expect(winningChances(-2000)).toBeLessThan(-0.99);
  });

  it("matches Lichess coefficient: wc(50) ≈ 0.092", () => {
    expect(winningChances(50)).toBeCloseTo(0.092, 2);
  });

  it("matches Lichess coefficient: wc(100) ≈ 0.182", () => {
    expect(winningChances(100)).toBeCloseTo(0.182, 2);
  });

  it("matches Lichess coefficient: wc(300) ≈ 0.504", () => {
    expect(winningChances(300)).toBeCloseTo(0.504, 2);
  });
});

describe("move classification via winning chances delta", () => {
  it("classifies equal → equal as best", () => {
    const delta = wcDelta(0, 0, true);
    expect(classifyDelta(delta)).toBe("best");
  });

  it("classifies a 50cp loss from equal as good (below inaccuracy threshold)", () => {
    const delta = wcDelta(0, -50, true);
    expect(classifyDelta(delta)).toBe("good");
  });

  it("classifies a 100cp loss from equal as inaccuracy", () => {
    const delta = wcDelta(0, -100, true);
    expect(classifyDelta(delta)).toBe("inaccuracy");
  });

  it("classifies a 300cp loss from equal as blunder", () => {
    const delta = wcDelta(0, -300, true);
    expect(classifyDelta(delta)).toBe("blunder");
  });

  it("classifies a small 20cp loss from equal as best (within engine noise)", () => {
    const delta = wcDelta(0, -20, true);
    expect(classifyDelta(delta)).toBe("best");
  });

  it("losing 200cp when already +2000 is NOT a blunder (still winning)", () => {
    const delta = wcDelta(2000, 1800, true);
    expect(classifyDelta(delta)).toBe("best");
  });

  it("losing 500cp when +1500 is still best/good (winning chances barely change)", () => {
    const delta = wcDelta(1500, 1000, true);
    const cls = classifyDelta(delta);
    expect(["best", "good"]).toContain(cls);
  });

  it("works from black's perspective: black moves, eval goes from -100 to 0", () => {
    const delta = wcDelta(-100, 0, false);
    expect(classifyDelta(delta)).toBe("inaccuracy");
  });

  it("black plays a good move: eval stays similar", () => {
    const delta = wcDelta(-50, -40, false);
    expect(classifyDelta(delta)).toBe("best");
  });

  it("improving the position (negative delta) is best", () => {
    const delta = wcDelta(0, 50, true);
    expect(classifyDelta(delta)).toBe("best");
  });

  it("+10 to +8 is NOT an inaccuracy (both positions are completely winning)", () => {
    const delta = wcDelta(1000, 800, true);
    const cls = classifyDelta(delta);
    expect(["best", "good"]).toContain(cls);
  });

  it("+1 to -1 is a mistake (significant swing but below blunder threshold)", () => {
    const delta = wcDelta(100, -100, true);
    expect(classifyDelta(delta)).toBe("mistake");
  });

  it("missing forced mate (10000 → 500) is a mistake (still winning at +5)", () => {
    const delta = wcDelta(10000, 500, true);
    expect(classifyDelta(delta)).toBe("mistake");
  });

  it("keeping a mate (10000 → 9997) is best", () => {
    const delta = wcDelta(10000, 9997, true);
    expect(classifyDelta(delta)).toBe("best");
  });
});

describe("engine eval capture (depth handling)", () => {
  it("captures eval when engine only reaches low depth (forced mate)", () => {
    const score = simulateBestEval([
      { depth: 1, whiteCp: 9998 },
      { depth: 2, whiteCp: 9999 },
      { depth: 4, whiteCp: 9998 },
    ]);
    expect(score).toBe(9998);
  });

  it("prefers highest depth eval", () => {
    const score = simulateBestEval([
      { depth: 5, whiteCp: 30 },
      { depth: 10, whiteCp: 45 },
      { depth: 18, whiteCp: 50 },
    ]);
    expect(score).toBe(50);
  });

  it("returns 0 when no info lines are received", () => {
    const score = simulateBestEval([]);
    expect(score).toBe(0);
  });

  it("captures eval when max depth is below ANALYSIS_DEPTH", () => {
    const score = simulateBestEval([
      { depth: 3, whiteCp: -200 },
      { depth: 6, whiteCp: -180 },
      { depth: 8, whiteCp: -175 },
    ]);
    expect(score).toBe(-175);
  });

  it("uses last eval at same max depth (later info overrides earlier)", () => {
    const score = simulateBestEval([
      { depth: 18, whiteCp: 40 },
      { depth: 18, whiteCp: 55 },
    ]);
    expect(score).toBe(55);
  });
});
