import { describe, it, expect } from "vitest";
import { Chess, Square } from "chess.js";

/**
 * These tests verify the legal move highlighting logic used in GameRoom.
 * The component computes legal moves via chess.js and classifies target
 * squares as empty (dot) or occupied (capture ring).
 */

function getLegalMovesForSquare(game: Chess, square: string): string[] {
  try {
    return game
      .moves({ square: square as Square, verbose: true })
      .map((m) => m.to);
  } catch {
    return [];
  }
}

function computeHighlights(game: Chess, selectedSquare: string) {
  const targets = getLegalMovesForSquare(game, selectedSquare);
  const result: Record<string, "source" | "dot" | "capture"> = {
    [selectedSquare]: "source",
  };
  for (const sq of targets) {
    const pieceOnTarget = game.get(sq as Square);
    result[sq] = pieceOnTarget ? "capture" : "dot";
  }
  return result;
}

describe("legal move highlighting", () => {
  it("highlights pawn moves from starting position", () => {
    const game = new Chess();
    const highlights = computeHighlights(game, "e2");

    expect(highlights["e2"]).toBe("source");
    expect(highlights["e3"]).toBe("dot");
    expect(highlights["e4"]).toBe("dot");
    expect(Object.keys(highlights)).toHaveLength(3);
  });

  it("highlights knight moves with all targets as dots on empty board area", () => {
    const game = new Chess();
    const highlights = computeHighlights(game, "g1");

    expect(highlights["g1"]).toBe("source");
    expect(highlights["f3"]).toBe("dot");
    expect(highlights["h3"]).toBe("dot");
    // Knight can only go to f3 and h3 from starting position
    expect(Object.keys(highlights)).toHaveLength(3);
  });

  it("returns only source for a piece with no legal moves", () => {
    const game = new Chess();
    // The rook on a1 has no legal moves in starting position
    const highlights = computeHighlights(game, "a1");

    expect(highlights["a1"]).toBe("source");
    expect(Object.keys(highlights)).toHaveLength(1);
  });

  it("marks capture squares correctly", () => {
    // Set up a position where a pawn can capture
    const game = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
    const highlights = computeHighlights(game, "e4");

    expect(highlights["e4"]).toBe("source");
    expect(highlights["e5"]).toBe("dot");
    expect(highlights["d5"]).toBe("capture"); // captures black pawn
    expect(Object.keys(highlights)).toHaveLength(3);
  });

  it("returns empty for an invalid square", () => {
    const game = new Chess();
    const moves = getLegalMovesForSquare(game, "z9");
    expect(moves).toEqual([]);
  });

  it("returns empty for an empty square", () => {
    const game = new Chess();
    const moves = getLegalMovesForSquare(game, "e4");
    expect(moves).toEqual([]);
  });

  it("returns empty for opponent's piece", () => {
    const game = new Chess();
    // It's white's turn, black's pieces have no legal moves from white's perspective
    // chess.js actually does return moves for black pieces when asked — but in the component
    // we filter by player color before calling this. Verify chess.js still returns the moves.
    const moves = getLegalMovesForSquare(game, "e7");
    // chess.js returns moves regardless of turn — the component guards by color
    expect(moves.length).toBe(0); // e7 pawn can't move on white's turn
  });

  it("shows all queen moves in an open position", () => {
    const game = new Chess("8/8/8/8/3Q4/8/8/4K2k w - - 0 1");
    const highlights = computeHighlights(game, "d4");

    expect(highlights["d4"]).toBe("source");
    // Queen should have many moves from d4 on an open board
    const moveCount = Object.keys(highlights).length - 1; // exclude source
    expect(moveCount).toBeGreaterThan(15);
  });

  it("does not include moves that would leave king in check", () => {
    // White king on e1, white rook on e2, black rook on e8
    // The e2 rook is pinned — it cannot move off the e-file
    const game = new Chess("4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1");
    const highlights = computeHighlights(game, "e2");

    expect(highlights["e2"]).toBe("source");
    // Rook on e2 can only move along the e-file (pinned)
    const targets = Object.keys(highlights).filter((k) => k !== "e2");
    for (const sq of targets) {
      expect(sq[0]).toBe("e"); // all targets must be on e-file
    }
  });

  it("highlights en passant capture", () => {
    // After 1.e4 d5 2.e5 f5 — e5 pawn can capture en passant on f6
    const game = new Chess("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3");
    const highlights = computeHighlights(game, "e5");

    expect(highlights["e5"]).toBe("source");
    expect(highlights["f6"]).toBeDefined(); // en passant on f6
    expect(highlights["e6"]).toBe("dot"); // normal push
  });

  it("highlights castling as a king move", () => {
    // Position where white can castle kingside
    const game = new Chess("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1");
    const highlights = computeHighlights(game, "e1");

    expect(highlights["e1"]).toBe("source");
    expect(highlights["g1"]).toBe("dot"); // kingside castle
    expect(highlights["c1"]).toBe("dot"); // queenside castle
  });

  it("clears highlights when selectedSquare is null", () => {
    const game = new Chess();
    // Simulating what the component does when selectedSquare is null
    const selectedSquare: string | null = null;
    const highlights = selectedSquare ? computeHighlights(game, selectedSquare) : {};

    expect(highlights).toEqual({});
  });
});
