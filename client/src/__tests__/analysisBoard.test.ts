import { describe, it, expect } from "vitest";
import { Chess, type Square } from "chess.js";
import {
  fenAfterMoves,
  navFen,
  navLastMove,
  inferOrientation,
  type AnalysisGameData,
  type Variation,
  type Nav,
} from "../components/AnalysisBoard";

const START_FEN = new Chess().fen();
const ITALIAN_GAME = ["e4", "e5", "Nf3", "Nc6", "Bc4"];

function fen(moves: string[], startFen?: string): string {
  const g = new Chess(startFen);
  for (const m of moves) g.move(m);
  return g.fen();
}

/* ---------- fenAfterMoves ---------- */

describe("fenAfterMoves", () => {
  it("returns start FEN for empty moves", () => {
    expect(fenAfterMoves(undefined, [])).toBe(START_FEN);
  });

  it("applies moves correctly", () => {
    expect(fenAfterMoves(undefined, ["e4", "e5"])).toBe(fen(["e4", "e5"]));
  });

  it("works with custom start FEN", () => {
    const custom = fen(["e4"]);
    expect(fenAfterMoves(custom, ["e5"])).toBe(fen(["e4", "e5"]));
  });

  it("returns fallback on invalid move instead of throwing", () => {
    const result = fenAfterMoves(undefined, ["Qd8"]);
    expect(result).toBe(START_FEN);
  });

  it("returns fallback on garbage SAN instead of throwing", () => {
    const result = fenAfterMoves(undefined, ["e4", "ZZZZZ"]);
    expect(result).toBe(START_FEN);
  });

  it("returns custom startFen as fallback when moves are invalid", () => {
    const custom = fen(["e4"]);
    const result = fenAfterMoves(custom, ["INVALID"]);
    expect(result).toBe(custom);
  });
});

/* ---------- navFen ---------- */

describe("navFen", () => {
  const gameMoves = ITALIAN_GAME;

  describe("main line navigation", () => {
    it("returns start FEN at index 0", () => {
      const nav: Nav = { on: "main", index: 0 };
      expect(navFen(undefined, gameMoves, [], nav)).toBe(START_FEN);
    });

    it("returns FEN after first move at index 1", () => {
      const nav: Nav = { on: "main", index: 1 };
      expect(navFen(undefined, gameMoves, [], nav)).toBe(fen(["e4"]));
    });

    it("returns FEN at end of game", () => {
      const nav: Nav = { on: "main", index: gameMoves.length };
      expect(navFen(undefined, gameMoves, [], nav)).toBe(fen(gameMoves));
    });

    it("clamps index that exceeds gameMoves length", () => {
      const nav: Nav = { on: "main", index: gameMoves.length + 10 };
      expect(navFen(undefined, gameMoves, [], nav)).toBe(fen(gameMoves));
    });
  });

  describe("variation navigation", () => {
    const variations: Variation[] = [
      { from: 2, moves: ["Bc4", "Bc5", "d3"] },
    ];

    it("returns FEN after first variation move", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 0 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(
        fen(["e4", "e5", "Bc4"])
      );
    });

    it("returns FEN after deeper variation move", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 2 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(
        fen(["e4", "e5", "Bc4", "Bc5", "d3"])
      );
    });

    it("clamps mi that exceeds variation length", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 100 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(
        fen(["e4", "e5", "Bc4", "Bc5", "d3"])
      );
    });

    it("returns start FEN when vi is out of bounds", () => {
      const nav: Nav = { on: "var", vi: 99, mi: 0 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(START_FEN);
    });

    it("returns start FEN when variations array is empty", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 0 };
      expect(navFen(undefined, gameMoves, [], nav)).toBe(START_FEN);
    });
  });

  describe("multiple variations", () => {
    const variations: Variation[] = [
      { from: 2, moves: ["Bc4"] },
      { from: 2, moves: ["Bb5"] },
      { from: 0, moves: ["d4", "d5"] },
    ];

    it("navigates to second variation", () => {
      const nav: Nav = { on: "var", vi: 1, mi: 0 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(
        fen(["e4", "e5", "Bb5"])
      );
    });

    it("navigates to variation from move 0", () => {
      const nav: Nav = { on: "var", vi: 2, mi: 1 };
      expect(navFen(undefined, gameMoves, variations, nav)).toBe(
        fen(["d4", "d5"])
      );
    });
  });
});

/* ---------- navLastMove ---------- */

describe("navLastMove", () => {
  const gameMoves = ITALIAN_GAME;

  it("returns null at index 0 (no move played)", () => {
    const nav: Nav = { on: "main", index: 0 };
    expect(navLastMove(undefined, gameMoves, [], nav)).toBeNull();
  });

  it("returns correct squares for first move e4", () => {
    const nav: Nav = { on: "main", index: 1 };
    const result = navLastMove(undefined, gameMoves, [], nav);
    expect(result).toEqual({ from: "e2", to: "e4" });
  });

  it("returns correct squares for Nf3", () => {
    const nav: Nav = { on: "main", index: 3 };
    const result = navLastMove(undefined, gameMoves, [], nav);
    expect(result).toEqual({ from: "g1", to: "f3" });
  });

  it("returns correct squares for last move Bc4", () => {
    const nav: Nav = { on: "main", index: 5 };
    const result = navLastMove(undefined, gameMoves, [], nav);
    expect(result).toEqual({ from: "f1", to: "c4" });
  });

  describe("variation last move", () => {
    const variations: Variation[] = [
      { from: 2, moves: ["Bc4", "Bc5"] },
    ];

    it("returns first variation move squares", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 0 };
      const result = navLastMove(undefined, gameMoves, variations, nav);
      expect(result).toEqual({ from: "f1", to: "c4" });
    });

    it("returns second variation move squares", () => {
      const nav: Nav = { on: "var", vi: 0, mi: 1 };
      const result = navLastMove(undefined, gameMoves, variations, nav);
      expect(result).toEqual({ from: "f8", to: "c5" });
    });

    it("returns null when vi is out of bounds", () => {
      const nav: Nav = { on: "var", vi: 99, mi: 0 };
      expect(navLastMove(undefined, gameMoves, variations, nav)).toBeNull();
    });
  });

  it("returns null for invalid SAN in game moves", () => {
    const nav: Nav = { on: "main", index: 1 };
    expect(navLastMove(undefined, ["GARBAGE"], [], nav)).toBeNull();
  });
});

/* ---------- legal move targets (analysis board squareStyles) ---------- */

function legalMoveTargetsForSquare(game: Chess, square: string): string[] {
  try {
    return game
      .moves({ square: square as Square, verbose: true })
      .map((m) => m.to);
  } catch {
    return [];
  }
}

describe("legalMoveTargetsForSquare (matches AnalysisBoard getLegalMovesForSquare)", () => {
  it("returns pawn pushes from e2 at start", () => {
    const g = new Chess();
    const t = legalMoveTargetsForSquare(g, "e2").sort();
    expect(t).toEqual(["e3", "e4"]);
  });

  it("returns empty for empty square", () => {
    const g = new Chess();
    expect(legalMoveTargetsForSquare(g, "e4")).toEqual([]);
  });

  it("returns knight hops from g1 at start", () => {
    const g = new Chess();
    const t = new Set(legalMoveTargetsForSquare(g, "g1"));
    expect(t.has("f3")).toBe(true);
    expect(t.has("h3")).toBe(true);
  });

  it("returns empty when square is wrong side to move", () => {
    const g = new Chess();
    expect(legalMoveTargetsForSquare(g, "e7")).toEqual([]);
  });
});

/* ---------- move validation and truncation detection ---------- */

function validateGameMoves(
  raw: string[],
  startFen?: string
): { gameMoves: string[]; movesTruncated: boolean } {
  if (raw.length === 0) return { gameMoves: raw, movesTruncated: false };
  const g = new Chess(startFen);
  const valid: string[] = [];
  for (const san of raw) {
    try {
      const m = g.move(san);
      if (!m) break;
      valid.push(san);
    } catch {
      break;
    }
  }
  return { gameMoves: valid, movesTruncated: valid.length < raw.length };
}

describe("move validation and truncation detection", () => {
  it("returns all moves when valid", () => {
    const result = validateGameMoves(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.gameMoves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.movesTruncated).toBe(false);
  });

  it("truncates at first invalid move and flags truncation", () => {
    const result = validateGameMoves(["e4", "e5", "INVALID", "Nf3"]);
    expect(result.gameMoves).toEqual(["e4", "e5"]);
    expect(result.movesTruncated).toBe(true);
  });

  it("detects undo race condition corruption (stale SAN from different position)", () => {
    const result = validateGameMoves(["e4", "e5", "Nf3", "Bb5", "d5", "Bxd5"]);
    expect(result.gameMoves).toEqual(["e4", "e5", "Nf3"]);
    expect(result.movesTruncated).toBe(true);
  });

  it("handles empty moves array", () => {
    const result = validateGameMoves([]);
    expect(result.gameMoves).toEqual([]);
    expect(result.movesTruncated).toBe(false);
  });

  it("handles all invalid moves", () => {
    const result = validateGameMoves(["GARBAGE"]);
    expect(result.gameMoves).toEqual([]);
    expect(result.movesTruncated).toBe(true);
  });

  it("validates with custom startFen", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const result = validateGameMoves(["e5", "Nf3"], afterE4);
    expect(result.gameMoves).toEqual(["e5", "Nf3"]);
    expect(result.movesTruncated).toBe(false);
  });

  it("truncates moves after checkmate", () => {
    const result = validateGameMoves([
      "e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#", "d5",
    ]);
    expect(result.gameMoves).toEqual([
      "e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#",
    ]);
    expect(result.movesTruncated).toBe(true);
  });
});

/* ---------- edge cases: rapid navigation resilience ---------- */

describe("rapid navigation resilience", () => {
  const gameMoves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"];

  it("navFen never throws, even with completely wrong state", () => {
    const cases: Nav[] = [
      { on: "main", index: -1 },
      { on: "main", index: 999 },
      { on: "var", vi: -1, mi: 0 },
      { on: "var", vi: 999, mi: 999 },
      { on: "var", vi: 0, mi: -1 },
    ];
    const vars: Variation[] = [{ from: 2, moves: ["Bc4"] }];
    for (const nav of cases) {
      expect(() => navFen(undefined, gameMoves, vars, nav)).not.toThrow();
    }
  });

  it("navLastMove never throws, even with bad indices", () => {
    const cases: Nav[] = [
      { on: "main", index: -1 },
      { on: "main", index: 999 },
      { on: "var", vi: -1, mi: 0 },
      { on: "var", vi: 999, mi: 0 },
    ];
    for (const nav of cases) {
      expect(() => navLastMove(undefined, gameMoves, [], nav)).not.toThrow();
    }
  });

  it("fenAfterMoves handles move that becomes illegal mid-sequence", () => {
    const result = fenAfterMoves(undefined, ["e4", "e5", "e5"]);
    expect(result).toBe(START_FEN);
  });

  it("navFen handles variation branching from end of game", () => {
    const vars: Variation[] = [
      { from: gameMoves.length, moves: ["d4"] },
    ];
    const nav: Nav = { on: "var", vi: 0, mi: 0 };
    const result = navFen(undefined, gameMoves, vars, nav);
    expect(result).toBe(fen([...gameMoves, "d4"]));
  });

  it("navFen handles variation with empty moves array", () => {
    const vars: Variation[] = [{ from: 2, moves: [] }];
    const nav: Nav = { on: "var", vi: 0, mi: 0 };
    expect(() => navFen(undefined, gameMoves, vars, nav)).not.toThrow();
  });

  it("navFen with invalid startFen falls back gracefully", () => {
    const result = navFen("not-a-fen", gameMoves, [], {
      on: "main",
      index: 1,
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

/* ---------- inferOrientation ---------- */

describe("inferOrientation", () => {
  it("returns saved orientation when present (white)", () => {
    const data: AnalysisGameData = { moves: ["e4"], orientation: "white", playerBlack: "Alice" };
    expect(inferOrientation(data, "Alice")).toBe("white");
  });

  it("returns saved orientation when present (black)", () => {
    const data: AnalysisGameData = { moves: ["e4"], orientation: "black", playerWhite: "Alice" };
    expect(inferOrientation(data, "Alice")).toBe("black");
  });

  it("infers black when playerName matches playerBlack and no saved orientation", () => {
    const data: AnalysisGameData = { moves: ["e4"], playerWhite: "Bob", playerBlack: "Alice" };
    expect(inferOrientation(data, "Alice")).toBe("black");
  });

  it("infers white when playerName matches playerWhite and no saved orientation", () => {
    const data: AnalysisGameData = { moves: ["e4"], playerWhite: "Alice", playerBlack: "Bob" };
    expect(inferOrientation(data, "Alice")).toBe("white");
  });

  it("defaults to white when playerName is not provided", () => {
    const data: AnalysisGameData = { moves: ["e4"], playerBlack: "Alice" };
    expect(inferOrientation(data)).toBe("white");
  });

  it("defaults to white when playerName matches neither player", () => {
    const data: AnalysisGameData = { moves: ["e4"], playerWhite: "Bob", playerBlack: "Carol" };
    expect(inferOrientation(data, "Alice")).toBe("white");
  });

  it("defaults to white when gameData is null", () => {
    expect(inferOrientation(null, "Alice")).toBe("white");
  });

  it("defaults to white when gameData is null and no playerName", () => {
    expect(inferOrientation(null)).toBe("white");
  });

  it("saved orientation takes precedence over playerName inference", () => {
    const data: AnalysisGameData = {
      moves: ["e4"],
      orientation: "white",
      playerWhite: "Bob",
      playerBlack: "Alice",
    };
    expect(inferOrientation(data, "Alice")).toBe("white");
  });
});
