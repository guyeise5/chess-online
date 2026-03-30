import mongoose from "mongoose";
import Room from "../models/Room";
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

describe("Room model", () => {
  it("has a TTL index on createdAt with 7-day expiry", async () => {
    await Room.createIndexes();
    const indexes = await Room.collection.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx.key?.createdAt === 1 && idx.expireAfterSeconds != null
    );

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex!.expireAfterSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("has a unique index on roomId", async () => {
    await Room.createIndexes();
    const indexes = await Room.collection.indexes();
    const roomIdIndex = indexes.find((idx) => idx.key?.roomId === 1);

    expect(roomIdIndex).toBeDefined();
    expect(roomIdIndex!.unique).toBe(true);
  });

  it("enforces required fields", async () => {
    const room = new Room({});
    const err = room.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("roomId");
    expect(err!.errors).toHaveProperty("owner");
    expect(err!.errors).toHaveProperty("timeFormat");
    expect(err!.errors).toHaveProperty("timeControl");
    expect(err!.errors).toHaveProperty("whiteTime");
    expect(err!.errors).toHaveProperty("blackTime");
  });

  it("enforces enum values for timeFormat", async () => {
    const room = new Room({
      roomId: "test1",
      owner: "Alice",
      timeFormat: "invalid" as any,
      timeControl: 300,
      whiteTime: 300,
      blackTime: 300,
    });
    const err = room.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("timeFormat");
  });

  it("enforces enum values for colorChoice", async () => {
    const room = new Room({
      roomId: "test2",
      owner: "Alice",
      timeFormat: "blitz",
      timeControl: 300,
      colorChoice: "blue" as any,
      whiteTime: 300,
      blackTime: 300,
    });
    const err = room.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("colorChoice");
  });

  it("enforces enum values for status", async () => {
    const room = new Room({
      roomId: "test3",
      owner: "Alice",
      timeFormat: "blitz",
      timeControl: 300,
      status: "canceled" as any,
      whiteTime: 300,
      blackTime: 300,
    });
    const err = room.validateSync();

    expect(err).toBeDefined();
    expect(err!.errors).toHaveProperty("status");
  });

  it("sets correct defaults", async () => {
    const room = new Room({
      roomId: "test4",
      owner: "Alice",
      timeFormat: "blitz",
      timeControl: 300,
      whiteTime: 300,
      blackTime: 300,
    });

    expect(room.status).toBe("waiting");
    expect(room.colorChoice).toBe("random");
    expect(room.turn).toBe("w");
    expect(room.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(room.moves).toEqual([]);
    expect(room.result).toBeNull();
    expect(room.opponent).toBeNull();
    expect(room.whitePlayer).toBeNull();
    expect(room.blackPlayer).toBeNull();
    expect(room.ownerName).toBe("");
    expect(room.opponentName).toBeNull();
    expect(room.whiteName).toBeNull();
    expect(room.blackName).toBeNull();
  });

  it("creates timestamps automatically", async () => {
    const room = await Room.create({
      roomId: "test5",
      owner: "Alice",
      timeFormat: "blitz",
      timeControl: 300,
      whiteTime: 300,
      blackTime: 300,
    });

    expect(room.createdAt).toBeInstanceOf(Date);
    expect(room.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects duplicate roomId", async () => {
    await Room.create({
      roomId: "dup1",
      owner: "Alice",
      timeFormat: "blitz",
      timeControl: 300,
      whiteTime: 300,
      blackTime: 300,
    });

    await expect(
      Room.create({
        roomId: "dup1",
        owner: "Bob",
        timeFormat: "rapid",
        timeControl: 600,
        whiteTime: 600,
        blackTime: 600,
      })
    ).rejects.toThrow();
  });
});
