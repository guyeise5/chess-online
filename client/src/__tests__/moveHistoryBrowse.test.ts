import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

/**
 * Replicates the historySnapshot logic used in GameRoom and ComputerGame
 * to compute a FEN and lastMove at a given ply.
 */
function computeHistorySnapshot(
  moves: string[],
  viewingPly: number
): { fen: string; lastMove: { from: string; to: string } | null } {
  const g = new Chess();
  let lm: { from: string; to: string } | null = null;
  for (let i = 0; i < viewingPly && i < moves.length; i++) {
    const m = g.move(moves[i]!);
    if (m) lm = { from: m.from, to: m.to };
  }
  return { fen: g.fen(), lastMove: lm };
}

describe("move history browsing", () => {
  const sampleMoves = ["e4", "e5", "Nf3", "Nc6", "Bb5"];

  it("ply 0 returns the starting position with no lastMove", () => {
    const snap = computeHistorySnapshot(sampleMoves, 0);
    expect(snap.fen).toBe(new Chess().fen());
    expect(snap.lastMove).toBeNull();
  });

  it("ply 1 shows position after the first move (1. e4)", () => {
    const snap = computeHistorySnapshot(sampleMoves, 1);
    const g = new Chess();
    g.move("e4");
    expect(snap.fen).toBe(g.fen());
    expect(snap.lastMove).toEqual({ from: "e2", to: "e4" });
  });

  it("ply 2 shows position after 1. e4 e5", () => {
    const snap = computeHistorySnapshot(sampleMoves, 2);
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    expect(snap.fen).toBe(g.fen());
    expect(snap.lastMove).toEqual({ from: "e7", to: "e5" });
  });

  it("ply equal to moves.length returns the final position", () => {
    const snap = computeHistorySnapshot(sampleMoves, sampleMoves.length);
    const g = new Chess();
    for (const m of sampleMoves) g.move(m);
    expect(snap.fen).toBe(g.fen());
    expect(snap.lastMove).toEqual({ from: "f1", to: "b5" });
  });

  it("ply beyond moves.length clamps to the last move", () => {
    const snap = computeHistorySnapshot(sampleMoves, 100);
    const g = new Chess();
    for (const m of sampleMoves) g.move(m);
    expect(snap.fen).toBe(g.fen());
  });

  it("empty moves list returns starting position for any ply", () => {
    const snap = computeHistorySnapshot([], 5);
    expect(snap.fen).toBe(new Chess().fen());
    expect(snap.lastMove).toBeNull();
  });

  describe("goToPly logic", () => {
    function goToPly(ply: number, movesLength: number): number | null {
      if (ply >= movesLength) return null;
      return Math.max(0, ply);
    }

    it("returns null when ply equals moves.length (back to live)", () => {
      expect(goToPly(5, 5)).toBeNull();
    });

    it("returns null when ply exceeds moves.length", () => {
      expect(goToPly(10, 5)).toBeNull();
    });

    it("returns ply when less than moves.length", () => {
      expect(goToPly(3, 5)).toBe(3);
    });

    it("clamps negative ply to 0", () => {
      expect(goToPly(-1, 5)).toBe(0);
    });

    it("returns 0 for ply 0", () => {
      expect(goToPly(0, 5)).toBe(0);
    });
  });

  describe("isBrowsingHistory", () => {
    function isBrowsingHistory(
      enabled: boolean,
      viewingPly: number | null,
      movesLength: number
    ): boolean {
      return enabled && viewingPly !== null && viewingPly < movesLength;
    }

    it("returns false when feature is disabled", () => {
      expect(isBrowsingHistory(false, 2, 5)).toBe(false);
    });

    it("returns false when viewingPly is null (live mode)", () => {
      expect(isBrowsingHistory(true, null, 5)).toBe(false);
    });

    it("returns true when viewing a past ply", () => {
      expect(isBrowsingHistory(true, 2, 5)).toBe(true);
    });

    it("returns false when viewingPly equals movesLength", () => {
      expect(isBrowsingHistory(true, 5, 5)).toBe(false);
    });

    it("returns true for ply 0 with non-empty moves", () => {
      expect(isBrowsingHistory(true, 0, 5)).toBe(true);
    });
  });

  describe("arrow key navigation logic", () => {
    function arrowLeft(prev: number | null, movesLength: number): number {
      const cur = prev ?? movesLength;
      return cur <= 0 ? 0 : cur - 1;
    }

    function arrowRight(prev: number | null, movesLength: number): number | null {
      if (prev === null) return null;
      return prev + 1 >= movesLength ? null : prev + 1;
    }

    it("ArrowLeft from live (null) goes to last move", () => {
      expect(arrowLeft(null, 5)).toBe(4);
    });

    it("ArrowLeft from ply 3 goes to ply 2", () => {
      expect(arrowLeft(3, 5)).toBe(2);
    });

    it("ArrowLeft from ply 0 stays at 0", () => {
      expect(arrowLeft(0, 5)).toBe(0);
    });

    it("ArrowRight from ply 3 goes to ply 4", () => {
      expect(arrowRight(3, 5)).toBe(4);
    });

    it("ArrowRight from last ply returns to live (null)", () => {
      expect(arrowRight(4, 5)).toBeNull();
    });

    it("ArrowRight from live (null) stays null", () => {
      expect(arrowRight(null, 5)).toBeNull();
    });

    it("ArrowLeft from ply 1 goes to ply 0", () => {
      expect(arrowLeft(1, 5)).toBe(0);
    });
  });
});
