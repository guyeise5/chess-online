import { setupDB, teardownDB, clearDB } from "./setup";
import Puzzle from "../models/Puzzle";

beforeAll(async () => {
  await setupDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("Puzzle model", () => {
  const samplePuzzle = {
    puzzleId: "abc123",
    fen: "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24",
    moves: ["f2g3", "e6e7", "b2b1", "b3c1", "b1c1", "h6c1"],
    rating: 2107,
    ratingDeviation: 78,
    popularity: 95,
    nbPlays: 9243,
    themes: ["crushing", "hangingPiece", "long", "middlegame"],
    gameUrl: "https://lichess.org/787zsVup/black#48",
    openingTags: [],
  };

  it("creates a puzzle with all fields", async () => {
    const puzzle = await Puzzle.create(samplePuzzle);
    expect(puzzle.puzzleId).toBe("abc123");
    expect(puzzle.rating).toBe(2107);
    expect(puzzle.moves).toHaveLength(6);
    expect(puzzle.themes).toContain("crushing");
  });

  it("enforces unique puzzleId", async () => {
    await Puzzle.create(samplePuzzle);
    await expect(Puzzle.create(samplePuzzle)).rejects.toThrow();
  });

  it("requires puzzleId, fen, moves, rating", async () => {
    await expect(Puzzle.create({})).rejects.toThrow();
  });

  it("can query by rating range", async () => {
    await Puzzle.insertMany([
      { ...samplePuzzle, puzzleId: "p1", rating: 1000 },
      { ...samplePuzzle, puzzleId: "p2", rating: 1500 },
      { ...samplePuzzle, puzzleId: "p3", rating: 2000 },
      { ...samplePuzzle, puzzleId: "p4", rating: 2500 },
    ]);

    const results = await Puzzle.find({ rating: { $gte: 1400, $lte: 1600 } });
    expect(results).toHaveLength(1);
    expect(results[0].puzzleId).toBe("p2");
  });

  it("supports $sample aggregation for random selection", async () => {
    await Puzzle.insertMany(
      Array.from({ length: 20 }, (_, i) => ({
        ...samplePuzzle,
        puzzleId: `rand-${i}`,
        rating: 1500,
      }))
    );

    const result = await Puzzle.aggregate([
      { $match: { rating: { $gte: 1300, $lte: 1700 } } },
      { $sample: { size: 1 } },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].puzzleId).toMatch(/^rand-/);
  });

  it("has a rating index", async () => {
    await Puzzle.ensureIndexes();
    const indexes = await Puzzle.collection.indexes();
    const ratingIndex = indexes.find(
      (idx: any) => idx.key && idx.key.rating !== undefined
    );
    expect(ratingIndex).toBeDefined();
  });
});
