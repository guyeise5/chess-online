import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { computeMaterialDiff } from "../utils/materialDiff";

describe("computeMaterialDiff", () => {
  it("returns empty diff for starting position", () => {
    const g = new Chess();
    const diff = computeMaterialDiff(g);
    expect(diff.white.pieces).toEqual([]);
    expect(diff.black.pieces).toEqual([]);
    expect(diff.white.points).toBe(0);
    expect(diff.black.points).toBe(0);
  });

  it("shows white advantage after white captures a pawn", () => {
    // 1. e4 d5 2. exd5
    const g = new Chess();
    g.move("e4");
    g.move("d5");
    g.move("exd5");
    const diff = computeMaterialDiff(g);
    expect(diff.white.pieces).toEqual([{ type: "p", count: 1 }]);
    expect(diff.white.points).toBe(1);
    expect(diff.black.pieces).toEqual([]);
    expect(diff.black.points).toBe(0);
  });

  it("shows black advantage after black captures a knight", () => {
    // 1. e4 e5 2. Nf3 d6 3. Nc3 Bg4 4. d3 Bxf3
    // Black's bishop captured white's knight — bishop is still on the board
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    g.move("Nf3");
    g.move("d6");
    g.move("Nc3");
    g.move("Bg4");
    g.move("d3");
    g.move("Bxf3");
    const diff = computeMaterialDiff(g);
    // White lost a knight, no black piece was captured
    expect(diff.black.pieces).toEqual([{ type: "n", count: 1 }]);
    expect(diff.black.points).toBe(3);
    expect(diff.white.pieces).toEqual([]);
    expect(diff.white.points).toBe(0);
  });

  it("shows correct diff when white wins the exchange (rook for bishop)", () => {
    // Set up a position where white has an extra rook and black has an extra bishop
    const g = new Chess(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK1NR w KQkq - 0 1"
    );
    // White is missing a bishop, but let's set a cleaner position:
    // Standard but remove white's f1 bishop and black's a8 rook
    const g2 = new Chess(
      "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQk - 0 1"
    );
    const diff = computeMaterialDiff(g2);
    // White has 2 rooks, black has 1 → white +1 rook
    expect(diff.white.pieces).toEqual([{ type: "r", count: 1 }]);
    expect(diff.white.points).toBe(5);
    expect(diff.black.pieces).toEqual([]);
    expect(diff.black.points).toBe(0);
  });

  it("handles multiple piece type differences", () => {
    // White has extra queen, black has 2 extra pawns
    // Start: remove black queen and 2 white pawns
    const g = new Chess(
      "rnb1kbnr/pppppppp/8/8/8/8/1PPPPP1P/RNBQKBNR w KQkq - 0 1"
    );
    const diff = computeMaterialDiff(g);
    // White: +1 queen (9pts)
    // Black: +2 pawns (2pts)
    // Net: white +7
    expect(diff.white.pieces).toEqual([{ type: "q", count: 1 }]);
    expect(diff.white.points).toBe(7);
    expect(diff.black.pieces).toEqual([{ type: "p", count: 2 }]);
    expect(diff.black.points).toBe(0);
  });

  it("shows net advantage on the correct side when both have extra pieces", () => {
    // White missing queen, black missing both bishops
    // FEN: black has no bishops, white has no queen
    const g = new Chess(
      "rn1qk1nr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1"
    );
    const diff = computeMaterialDiff(g);
    // White: 2R, 2N, 2B, 0Q, 8P
    // Black: 2R, 2N, 0B, 1Q, 8P
    // White has +2 bishops (6pts), black has +1 queen (9pts)
    // Net: black +3
    expect(diff.white.pieces).toEqual([{ type: "b", count: 2 }]);
    expect(diff.black.pieces).toEqual([{ type: "q", count: 1 }]);
    expect(diff.white.points).toBe(0);
    expect(diff.black.points).toBe(3);
  });

  it("returns zero points when material is exactly equal despite differences", () => {
    // White has extra knight, black has extra bishop — equal value
    const g = new Chess(
      "rnbqk1nr/pppppppp/8/8/8/8/PPPPPPPP/RN1QKBNR w KQkq - 0 1"
    );
    // White missing bishop, black missing bishop → actually both missing bishop
    // Let me use a better FEN: white has extra knight, black has extra bishop
    // White: 2 knights, 1 bishop; Black: 1 knight, 2 bishops
    const g2 = new Chess(
      "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK1NR w KQkq - 0 1"
    );
    // White: 2N, 1B. Black: 1N, 2B.
    // diff knights: 2-1 = +1 for white
    // diff bishops: 1-2 = -1 for black
    // net: 3-3 = 0
    const diff = computeMaterialDiff(g2);
    expect(diff.white.pieces).toEqual([{ type: "n", count: 1 }]);
    expect(diff.black.pieces).toEqual([{ type: "b", count: 1 }]);
    expect(diff.white.points).toBe(0);
    expect(diff.black.points).toBe(0);
  });

  it("piece order is queen, rook, bishop, knight, pawn", () => {
    // Remove all of black's pieces except king
    const g = new Chess("4k3/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1");
    const diff = computeMaterialDiff(g);
    const types = diff.white.pieces.map((p) => p.type);
    expect(types).toEqual(["q", "r", "b", "n", "p"]);
  });
});

