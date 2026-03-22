import { setupDB, teardownDB, clearDB } from "./setup";
import BookPosition from "../models/BookPosition";

beforeAll(async () => {
  await setupDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("BookPosition model", () => {
  const sampleFen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3";

  it("creates a book position with a fen", async () => {
    const pos = await BookPosition.create({ fen: sampleFen });
    expect(pos.fen).toBe(sampleFen);
  });

  it("enforces unique fen", async () => {
    await BookPosition.create({ fen: sampleFen });
    await expect(BookPosition.create({ fen: sampleFen })).rejects.toThrow();
  });

  it("requires fen field", async () => {
    await expect(BookPosition.create({})).rejects.toThrow();
  });

  it("can look up multiple FENs with $in", async () => {
    const fens = [
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
      "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3",
      "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3",
    ];
    await BookPosition.insertMany(fens.map((fen) => ({ fen })));

    const query = [fens[0], fens[2], "not/in/book w - -"];
    const found = await BookPosition.find(
      { fen: { $in: query } },
      { fen: 1, _id: 0 }
    ).lean();

    expect(found).toHaveLength(2);
    const foundFens = new Set(found.map((d) => d.fen));
    expect(foundFens.has(fens[0])).toBe(true);
    expect(foundFens.has(fens[2])).toBe(true);
  });

  it("has a unique fen index", async () => {
    await BookPosition.ensureIndexes();
    const indexes = await BookPosition.collection.indexes();
    const fenIndex = indexes.find(
      (idx: any) => idx.key && idx.key.fen !== undefined
    );
    expect(fenIndex).toBeDefined();
    expect(fenIndex!.unique).toBe(true);
  });
});
