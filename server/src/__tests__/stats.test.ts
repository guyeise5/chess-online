import mongoose from "mongoose";
import express from "express";
import request from "supertest";
import Room from "../models/Room";
import { setupDB, teardownDB, clearDB } from "./setup";
import { deriveTimeFormat } from "../models/Room";

let app: express.Express;

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: `r-${Math.random().toString(36).slice(2, 8)}`,
    owner: "Alice",
    opponent: "Bob",
    timeFormat: "blitz",
    timeControl: 300,
    timeIncrement: 0,
    status: "finished",
    whitePlayer: "Alice",
    blackPlayer: "Bob",
    whiteTime: 120,
    blackTime: 90,
    result: "1-0",
    moves: ["e4", "e5", "Nf3"],
    ...overrides,
  };
}

beforeAll(async () => {
  await setupDB();

  app = express();
  app.use(express.json());

  app.get("/api/stats/daily", async (_req, res) => {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        res.status(503).json({ error: "DB unavailable" });
        return;
      }

      const matchFinished = { status: "finished" };

      const [gamesPerDay, activePlayers, timeFormats, results, avgMoves, peakHours, privateVsPublic] =
        await Promise.all([
          Room.aggregate([
            { $match: matchFinished },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", count: 1, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: matchFinished },
            {
              $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                players: {
                  $filter: {
                    input: ["$whitePlayer", "$blackPlayer"],
                    cond: { $ne: ["$$this", null] },
                  },
                },
              },
            },
            { $unwind: "$players" },
            { $group: { _id: { date: "$date", player: "$players" } } },
            { $group: { _id: "$_id.date", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", count: 1, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: matchFinished },
            { $group: { _id: "$timeFormat", count: { $sum: 1 } } },
            { $project: { format: "$_id", count: 1, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: { ...matchFinished, result: { $ne: null } } },
            { $group: { _id: "$result", count: { $sum: 1 } } },
            { $project: { result: "$_id", count: 1, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: matchFinished },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                avgMoves: { $avg: { $size: "$moves" } },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", avgMoves: { $round: ["$avgMoves", 1] }, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: matchFinished },
            { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { hour: "$_id", count: 1, _id: 0 } },
          ]),

          Room.aggregate([
            { $match: matchFinished },
            {
              $group: {
                _id: { $ifNull: ["$isPrivate", false] },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                type: { $cond: ["$_id", "private", "public"] },
                count: 1,
                _id: 0,
              },
            },
          ]),
        ]);

      res.json({
        gamesPerDay,
        activePlayers,
        timeFormats,
        results,
        avgMoves,
        peakHours,
        privateVsPublic,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("GET /api/stats/daily", () => {
  it("returns empty arrays when no rooms exist", async () => {
    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);
    expect(res.body.gamesPerDay).toEqual([]);
    expect(res.body.activePlayers).toEqual([]);
    expect(res.body.timeFormats).toEqual([]);
    expect(res.body.results).toEqual([]);
    expect(res.body.avgMoves).toEqual([]);
    expect(res.body.peakHours).toEqual([]);
    expect(res.body.privateVsPublic).toEqual([]);
  });

  it("counts finished games per day", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Room.create(makeRoom({ roomId: "r1", createdAt: today }));
    await Room.create(makeRoom({ roomId: "r2", createdAt: today }));
    await Room.create(makeRoom({ roomId: "r3", createdAt: yesterday }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);
    expect(res.body.gamesPerDay).toHaveLength(2);

    const totalGames = res.body.gamesPerDay.reduce(
      (sum: number, d: { count: number }) => sum + d.count,
      0
    );
    expect(totalGames).toBe(3);
  });

  it("excludes non-finished rooms from all stats", async () => {
    await Room.create(makeRoom({ roomId: "r-wait", status: "waiting" }));
    await Room.create(makeRoom({ roomId: "r-play", status: "playing" }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);
    expect(res.body.gamesPerDay).toEqual([]);
    expect(res.body.activePlayers).toEqual([]);
  });

  it("counts unique active players per day", async () => {
    const today = new Date();
    await Room.create(makeRoom({ roomId: "r1", whitePlayer: "Alice", blackPlayer: "Bob", createdAt: today }));
    await Room.create(makeRoom({ roomId: "r2", whitePlayer: "Alice", blackPlayer: "Charlie", createdAt: today }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const todayStr = today.toISOString().slice(0, 10);
    const entry = res.body.activePlayers.find((d: { date: string }) => d.date === todayStr);
    expect(entry).toBeDefined();
    expect(entry.count).toBe(3);
  });

  it("groups by time format", async () => {
    await Room.create(makeRoom({ roomId: "r1", timeFormat: "blitz" }));
    await Room.create(makeRoom({ roomId: "r2", timeFormat: "blitz" }));
    await Room.create(makeRoom({ roomId: "r3", timeFormat: "rapid" }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const blitz = res.body.timeFormats.find((d: { format: string }) => d.format === "blitz");
    const rapid = res.body.timeFormats.find((d: { format: string }) => d.format === "rapid");
    expect(blitz?.count).toBe(2);
    expect(rapid?.count).toBe(1);
  });

  it("groups by result", async () => {
    await Room.create(makeRoom({ roomId: "r1", result: "1-0" }));
    await Room.create(makeRoom({ roomId: "r2", result: "0-1" }));
    await Room.create(makeRoom({ roomId: "r3", result: "1/2-1/2" }));
    await Room.create(makeRoom({ roomId: "r4", result: "1-0" }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const whiteWins = res.body.results.find((d: { result: string }) => d.result === "1-0");
    const blackWins = res.body.results.find((d: { result: string }) => d.result === "0-1");
    const draws = res.body.results.find((d: { result: string }) => d.result === "1/2-1/2");
    expect(whiteWins?.count).toBe(2);
    expect(blackWins?.count).toBe(1);
    expect(draws?.count).toBe(1);
  });

  it("computes average moves per day", async () => {
    const today = new Date();
    await Room.create(makeRoom({ roomId: "r1", moves: ["e4", "e5", "Nf3", "Nc6"], createdAt: today }));
    await Room.create(makeRoom({ roomId: "r2", moves: ["d4", "d5"], createdAt: today }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const todayStr = today.toISOString().slice(0, 10);
    const entry = res.body.avgMoves.find((d: { date: string }) => d.date === todayStr);
    expect(entry).toBeDefined();
    expect(entry.avgMoves).toBe(3);
  });

  it("groups games by hour of day", async () => {
    const d1 = new Date("2025-06-01T14:00:00Z");
    const d2 = new Date("2025-06-01T14:30:00Z");
    const d3 = new Date("2025-06-01T20:00:00Z");

    await Room.create(makeRoom({ roomId: "r1", createdAt: d1 }));
    await Room.create(makeRoom({ roomId: "r2", createdAt: d2 }));
    await Room.create(makeRoom({ roomId: "r3", createdAt: d3 }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const h14 = res.body.peakHours.find((d: { hour: number }) => d.hour === 14);
    const h20 = res.body.peakHours.find((d: { hour: number }) => d.hour === 20);
    expect(h14?.count).toBe(2);
    expect(h20?.count).toBe(1);
  });

  it("separates private and public games", async () => {
    await Room.create(makeRoom({ roomId: "r1", isPrivate: false }));
    await Room.create(makeRoom({ roomId: "r2", isPrivate: false }));
    await Room.create(makeRoom({ roomId: "r3", isPrivate: true }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const pub = res.body.privateVsPublic.find((d: { type: string }) => d.type === "public");
    const priv = res.body.privateVsPublic.find((d: { type: string }) => d.type === "private");
    expect(pub?.count).toBe(2);
    expect(priv?.count).toBe(1);
  });

  it("counts rooms with missing isPrivate as public (no duplicate public entry)", async () => {
    await Room.create(makeRoom({ roomId: "r1", isPrivate: false }));
    const doc = await Room.create(makeRoom({ roomId: "r2" }));
    await Room.collection.updateOne({ _id: doc._id }, { $unset: { isPrivate: "" } });
    await Room.create(makeRoom({ roomId: "r3", isPrivate: true }));

    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);

    const publicEntries = res.body.privateVsPublic.filter((d: { type: string }) => d.type === "public");
    expect(publicEntries).toHaveLength(1);
    expect(publicEntries[0].count).toBe(2);

    const priv = res.body.privateVsPublic.find((d: { type: string }) => d.type === "private");
    expect(priv?.count).toBe(1);
  });

  it("response contains all expected keys", async () => {
    const res = await request(app).get("/api/stats/daily");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("gamesPerDay");
    expect(res.body).toHaveProperty("activePlayers");
    expect(res.body).toHaveProperty("timeFormats");
    expect(res.body).toHaveProperty("results");
    expect(res.body).toHaveProperty("avgMoves");
    expect(res.body).toHaveProperty("peakHours");
    expect(res.body).toHaveProperty("privateVsPublic");
  });
});
