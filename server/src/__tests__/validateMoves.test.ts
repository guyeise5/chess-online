import { validateMoves } from "../utils/validateMoves";

describe("validateMoves", () => {
  it("returns all moves when sequence is valid", () => {
    const result = validateMoves(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.validMoves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(result.truncated).toBe(false);
  });

  it("returns empty for empty input", () => {
    const result = validateMoves([]);
    expect(result.validMoves).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("returns empty with truncated true when startFen is invalid", () => {
    const result = validateMoves(["e4"], "not-a-fen");
    expect(result.validMoves).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("truncates at the first invalid move", () => {
    const result = validateMoves(["e4", "e5", "INVALID", "Nf3"]);
    expect(result.validMoves).toEqual(["e4", "e5"]);
    expect(result.truncated).toBe(true);
  });

  it("handles corruption from undo race condition (stale SAN from wrong position)", () => {
    const result = validateMoves(["e4", "e5", "Nf3", "Bb5", "d5"]);
    expect(result.validMoves).toEqual(["e4", "e5", "Nf3"]);
    expect(result.truncated).toBe(true);
  });

  it("returns empty when the first move is invalid", () => {
    const result = validateMoves(["GARBAGE"]);
    expect(result.validMoves).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("validates from a custom startFen", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const result = validateMoves(["e5", "Nf3"], afterE4);
    expect(result.validMoves).toEqual(["e5", "Nf3"]);
    expect(result.truncated).toBe(false);
  });

  it("rejects moves invalid for a custom startFen", () => {
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const result = validateMoves(["Nf3"], afterE4);
    expect(result.validMoves).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("validates a full game to checkmate", () => {
    const scholarsMate = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
    const result = validateMoves(scholarsMate);
    expect(result.validMoves).toEqual(scholarsMate);
    expect(result.truncated).toBe(false);
  });

  it("truncates moves after checkmate", () => {
    const result = validateMoves([
      "e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#", "d5",
    ]);
    expect(result.validMoves).toEqual([
      "e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#",
    ]);
    expect(result.truncated).toBe(true);
  });
});
