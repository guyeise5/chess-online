import mongoose from "mongoose";
import Game from "../models/Game";
import { setupDB, teardownDB, clearDB } from "./setup";

beforeAll(async () => {
  await setupDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("Game model", () => {
  const sampleGame = {
    gameId: "abc123",
    moves: ["e4", "e5", "Nf3", "Nc6"],
    playerWhite: "Alice",
    playerBlack: "Bob",
    orientation: "white" as const,
  };

  it("has a TTL index on createdAt with 14-day expiry", async () => {
    await Game.createIndexes();
    const indexes = await Game.collection.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx.key?.createdAt === 1 && idx.expireAfterSeconds != null
    );

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex!.expireAfterSeconds).toBe(14 * 24 * 60 * 60);
  });

  it("has a unique index on gameId", async () => {
    await Game.createIndexes();
    const indexes = await Game.collection.indexes();
    const gameIdIndex = indexes.find((idx) => idx.key?.gameId === 1);

    expect(gameIdIndex).toBeDefined();
    expect(gameIdIndex!.unique).toBe(true);
  });

  it("uses the 'games' collection", () => {
    expect(Game.collection.collectionName).toBe("games");
  });

  it("enforces required gameId", () => {
    const game = new Game({});
    const err = game.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("gameId");
  });

  it("saves and retrieves a game", async () => {
    await Game.create(sampleGame);
    const found = await Game.findOne({ gameId: "abc123" }).lean();

    expect(found).toBeDefined();
    expect(found!.moves).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(found!.playerWhite).toBe("Alice");
    expect(found!.playerBlack).toBe("Bob");
    expect(found!.orientation).toBe("white");
  });

  it("saves optional fields as undefined when not provided", async () => {
    await Game.create({ gameId: "minimal", moves: ["d4"] });
    const found = await Game.findOne({ gameId: "minimal" }).lean();

    expect(found).toBeDefined();
    expect(found!.startFen).toBeUndefined();
    expect(found!.playerWhite).toBeUndefined();
  });

  it("rejects duplicate gameId", async () => {
    await Game.create(sampleGame);
    await expect(Game.create(sampleGame)).rejects.toThrow();
  });

  it("upserts via findOneAndUpdate", async () => {
    await Game.findOneAndUpdate(
      { gameId: "upsert1" },
      { gameId: "upsert1", moves: ["e4"] },
      { upsert: true, new: true }
    );
    const found = await Game.findOne({ gameId: "upsert1" }).lean();
    expect(found).toBeDefined();
    expect(found!.moves).toEqual(["e4"]);

    await Game.findOneAndUpdate(
      { gameId: "upsert1" },
      { moves: ["e4", "e5"] },
      { upsert: true, new: true }
    );
    const updated = await Game.findOne({ gameId: "upsert1" }).lean();
    expect(updated!.moves).toEqual(["e4", "e5"]);
  });

  it("sets createdAt timestamp automatically", async () => {
    const doc = await Game.create(sampleGame);
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it("validates orientation enum", () => {
    const game = new Game({
      gameId: "test-enum",
      moves: ["e4"],
      orientation: "invalid" as any,
    });
    const err = game.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("orientation");
  });
});
