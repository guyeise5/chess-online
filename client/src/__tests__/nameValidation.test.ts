import { describe, it, expect } from "vitest";

const RESERVED_NAME_PATTERN = /^stockfish/i;

function isReservedName(name: string): boolean {
  return RESERVED_NAME_PATTERN.test(name.trim());
}

describe("reserved name validation", () => {
  it("blocks 'Stockfish' exactly", () => {
    expect(isReservedName("Stockfish")).toBe(true);
  });

  it("blocks 'Stockfish 3' (computer player name)", () => {
    expect(isReservedName("Stockfish 3")).toBe(true);
  });

  it("blocks 'stockfish' (case-insensitive)", () => {
    expect(isReservedName("stockfish")).toBe(true);
  });

  it("blocks 'STOCKFISH Level 12'", () => {
    expect(isReservedName("STOCKFISH Level 12")).toBe(true);
  });

  it("blocks 'StOcKfIsH xyz'", () => {
    expect(isReservedName("StOcKfIsH xyz")).toBe(true);
  });

  it("blocks name with leading spaces", () => {
    expect(isReservedName("  Stockfish")).toBe(true);
  });

  it("allows normal names", () => {
    expect(isReservedName("Alice")).toBe(false);
    expect(isReservedName("Bob")).toBe(false);
    expect(isReservedName("Player1")).toBe(false);
  });

  it("allows names containing 'stockfish' not at the start", () => {
    expect(isReservedName("NotStockfish")).toBe(false);
    expect(isReservedName("MyStockfish")).toBe(false);
  });

  it("allows empty string (caught by length check separately)", () => {
    expect(isReservedName("")).toBe(false);
  });
});
