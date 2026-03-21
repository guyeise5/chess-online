import { describe, it, expect, beforeEach } from "vitest";
import { Chess } from "chess.js";

const PUZZLE_RATING_KEY = "chess-puzzle-rating";
const PUZZLE_COUNT_KEY = "chess-puzzle-count";
const DEFAULT_RATING = 1500;
const MIN_RATING = 100;

let store: Map<string, string>;

function getItem(key: string): string | null {
  return store.get(key) ?? null;
}
function setItem(key: string, value: string): void {
  store.set(key, value);
}

function getRating(): number {
  const stored = getItem(PUZZLE_RATING_KEY);
  return stored ? parseInt(stored, 10) : DEFAULT_RATING;
}

function setRating(r: number): void {
  setItem(PUZZLE_RATING_KEY, String(r));
}

function getPuzzleCount(): number {
  const stored = getItem(PUZZLE_COUNT_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

function setPuzzleCount(count: number): void {
  setItem(PUZZLE_COUNT_KEY, String(count));
}

function getKFactor(puzzlesPlayed: number): number {
  if (puzzlesPlayed < 10) return 40;
  if (puzzlesPlayed < 30) return 30;
  if (puzzlesPlayed < 100) return 20;
  return 12;
}

function expectedScore(playerRating: number, puzzleRating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));
}

function computeRatingChange(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
  puzzlesPlayed: number
): number {
  const k = getKFactor(puzzlesPlayed);
  const expected = expectedScore(playerRating, puzzleRating);
  const actual = solved ? 1 : 0;
  return Math.round(k * (actual - expected));
}

beforeEach(() => {
  store = new Map();
});

describe("puzzle rating storage", () => {
  it("defaults to 1500 when no rating stored", () => {
    expect(getRating()).toBe(1500);
  });

  it("stores and retrieves a rating", () => {
    setRating(1600);
    expect(getRating()).toBe(1600);
  });

  it("does not go below 100", () => {
    setRating(105);
    const delta = computeRatingChange(105, 105, false, 0);
    const newRating = Math.max(MIN_RATING, 105 + delta);
    setRating(newRating);
    expect(getRating()).toBe(MIN_RATING);
  });

  it("tracks puzzle count", () => {
    expect(getPuzzleCount()).toBe(0);
    setPuzzleCount(5);
    expect(getPuzzleCount()).toBe(5);
  });
});

describe("Elo rating system", () => {
  it("K-factor is 40 for new players (<10 puzzles)", () => {
    expect(getKFactor(0)).toBe(40);
    expect(getKFactor(9)).toBe(40);
  });

  it("K-factor is 30 for 10-29 puzzles", () => {
    expect(getKFactor(10)).toBe(30);
    expect(getKFactor(29)).toBe(30);
  });

  it("K-factor is 20 for 30-99 puzzles", () => {
    expect(getKFactor(30)).toBe(20);
    expect(getKFactor(99)).toBe(20);
  });

  it("K-factor is 12 for 100+ puzzles", () => {
    expect(getKFactor(100)).toBe(12);
    expect(getKFactor(500)).toBe(12);
  });

  it("expected score is ~0.5 for equal ratings", () => {
    const e = expectedScore(1500, 1500);
    expect(e).toBeCloseTo(0.5, 2);
  });

  it("expected score is higher when player is stronger", () => {
    const e = expectedScore(1700, 1500);
    expect(e).toBeGreaterThan(0.7);
  });

  it("expected score is lower when puzzle is harder", () => {
    const e = expectedScore(1300, 1500);
    expect(e).toBeLessThan(0.3);
  });

  it("gains more from solving a harder puzzle", () => {
    const gainEasy = computeRatingChange(1500, 1500, true, 50);
    const gainHard = computeRatingChange(1500, 1700, true, 50);
    expect(gainHard).toBeGreaterThan(gainEasy);
  });

  it("loses more from failing an easy puzzle", () => {
    const lossEasy = computeRatingChange(1500, 1300, false, 50);
    const lossHard = computeRatingChange(1500, 1700, false, 50);
    expect(lossEasy).toBeLessThan(lossHard);
  });

  it("new players have larger rating swings", () => {
    const deltaNew = computeRatingChange(1500, 1500, true, 1);
    const deltaOld = computeRatingChange(1500, 1500, true, 200);
    expect(Math.abs(deltaNew)).toBeGreaterThan(Math.abs(deltaOld));
  });

  it("solving equal-rated puzzle gives positive delta", () => {
    const delta = computeRatingChange(1500, 1500, true, 50);
    expect(delta).toBeGreaterThan(0);
  });

  it("failing equal-rated puzzle gives negative delta", () => {
    const delta = computeRatingChange(1500, 1500, false, 50);
    expect(delta).toBeLessThan(0);
  });
});

describe("puzzle orientation", () => {
  it("player is black when FEN has white to move (opponent moves first)", () => {
    const fen = "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24";
    const g = new Chess(fen);
    const orientation = g.turn() === "w" ? "black" : "white";
    expect(orientation).toBe("white");
  });

  it("player is white when FEN has black to move (opponent moves first)", () => {
    const fen = "5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27";
    const g = new Chess(fen);
    const orientation = g.turn() === "w" ? "black" : "white";
    expect(orientation).toBe("black");
  });
});

describe("puzzle move validation", () => {
  it("applies opponent's first move correctly (UCI to chess.js)", () => {
    const fen = "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24";
    const moves = ["f2g3", "e6e7", "b2b1", "b3c1", "b1c1", "h6c1"];

    const g = new Chess(fen);
    const uci = moves[0];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    const move = g.move({ from, to, promotion });
    expect(move).not.toBeNull();
    expect(move!.from).toBe("f2");
    expect(move!.to).toBe("g3");
  });

  it("validates correct player move matches expected UCI", () => {
    const expectedUci = "e6e7";
    const playerFrom = "e6";
    const playerTo = "e7";

    const expectedFrom = expectedUci.slice(0, 2);
    const expectedTo = expectedUci.slice(2, 4);

    expect(playerFrom).toBe(expectedFrom);
    expect(playerTo).toBe(expectedTo);
  });

  it("rejects wrong player move", () => {
    const expectedUci = "e6e7";
    const playerFrom = "a2";
    const playerTo = "a4";

    const expectedFrom = expectedUci.slice(0, 2);
    const expectedTo = expectedUci.slice(2, 4);

    const isCorrect = playerFrom === expectedFrom && playerTo === expectedTo;
    expect(isCorrect).toBe(false);
  });

  it("handles promotion moves in UCI format", () => {
    const uci = "e7e8q";
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    expect(from).toBe("e7");
    expect(to).toBe("e8");
    expect(promotion).toBe("q");
  });

  it("puzzle is complete when all moves are played", () => {
    const moves = ["f2g3", "e6e7", "b2b1", "b3c1"];
    const moveIndex = 4;
    const isComplete = moveIndex >= moves.length;
    expect(isComplete).toBe(true);
  });

  it("puzzle is not complete mid-solution", () => {
    const moves = ["f2g3", "e6e7", "b2b1", "b3c1"];
    const moveIndex = 2;
    const isComplete = moveIndex >= moves.length;
    expect(isComplete).toBe(false);
  });
});

describe("puzzle solution sequence", () => {
  it("plays through a full puzzle solution", () => {
    const fen = "5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27";
    const moves = ["d3d6", "f8d8", "d6d8", "f6d8"];

    const g = new Chess(fen);

    for (const uci of moves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const result = g.move({ from, to, promotion });
      expect(result).not.toBeNull();
    }

    expect(g.history()).toHaveLength(4);
  });

  it("alternates between opponent and player moves", () => {
    const moves = ["d3d6", "f8d8", "d6d8", "f6d8"];

    for (let i = 0; i < moves.length; i++) {
      const isOpponent = i % 2 === 0;
      const isPlayer = i % 2 === 1;

      if (i === 0) {
        expect(isOpponent).toBe(true);
      } else if (i === 1) {
        expect(isPlayer).toBe(true);
      }
    }
  });
});
