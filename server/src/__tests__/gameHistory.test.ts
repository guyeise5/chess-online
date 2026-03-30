import mongoose from "mongoose";
import express from "express";
import http from "http";
import request from "supertest";
import Game from "../models/Game";
import { setupDB, teardownDB, clearDB } from "./setup";

let app: express.Express;

beforeAll(async () => {
  await setupDB();

  app = express();
  app.use(express.json());

  app.get("/api/games", async (req, res) => {
    try {
      const player = req.query.player as string;
      if (!player) {
        res.status(400).json({ error: "player query parameter is required" });
        return;
      }
      const games = await Game.find({
        $or: [{ playerWhite: player }, { playerBlack: player }],
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json(
        games.map((g) => ({
          gameId: g.gameId,
          moves: g.moves,
          playerWhite: g.playerWhite,
          playerBlack: g.playerBlack,
          displayWhite: g.displayWhite ?? g.playerWhite,
          displayBlack: g.displayBlack ?? g.playerBlack,
          orientation: g.orientation,
          result: g.result,
          createdAt: g.createdAt,
        }))
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to list games" });
    }
  });
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("Game model — result field", () => {
  it("saves and retrieves a game with result", async () => {
    await Game.create({
      gameId: "g1",
      moves: ["e4", "e5"],
      playerWhite: "Alice",
      playerBlack: "Bob",
      result: "1-0",
    });
    const found = await Game.findOne({ gameId: "g1" }).lean();
    expect(found).toBeDefined();
    expect(found!.result).toBe("1-0");
  });

  it("result is optional (undefined when not provided)", async () => {
    await Game.create({ gameId: "g2", moves: ["d4"] });
    const found = await Game.findOne({ gameId: "g2" }).lean();
    expect(found!.result).toBeUndefined();
  });

  it("accepts all standard chess results", async () => {
    for (const result of ["1-0", "0-1", "1/2-1/2"]) {
      const gameId = `result-${result}`;
      await Game.create({ gameId, moves: ["e4"], result });
      const found = await Game.findOne({ gameId }).lean();
      expect(found!.result).toBe(result);
    }
  });
});

describe("GET /api/games?player=", () => {
  const games = [
    {
      gameId: "a1",
      moves: ["e4", "e5", "Nf3"],
      playerWhite: "Alice",
      playerBlack: "Bob",
      displayWhite: "Alice D.",
      displayBlack: "Bob D.",
      result: "1-0",
    },
    {
      gameId: "a2",
      moves: ["d4", "d5"],
      playerWhite: "Charlie",
      playerBlack: "Alice",
      displayWhite: "Charlie D.",
      displayBlack: "Alice D.",
      result: "0-1",
    },
    {
      gameId: "a3",
      moves: ["c4"],
      playerWhite: "Bob",
      playerBlack: "Charlie",
      displayWhite: "Bob D.",
      displayBlack: "Charlie D.",
      result: "1/2-1/2",
    },
  ];

  beforeEach(async () => {
    for (const g of games) {
      await Game.create(g);
    }
  });

  it("returns 400 when player parameter is missing", async () => {
    const res = await request(app).get("/api/games");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("player");
  });

  it("returns games where player is white", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    const ids = res.body.map((g: any) => g.gameId);
    expect(ids).toContain("a1");
  });

  it("returns games where player is black", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    const ids = res.body.map((g: any) => g.gameId);
    expect(ids).toContain("a2");
  });

  it("does not return games where player is not involved", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    const ids = res.body.map((g: any) => g.gameId);
    expect(ids).not.toContain("a3");
  });

  it("returns both white and black games for a player", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("includes result field in response", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    const g1 = res.body.find((g: any) => g.gameId === "a1");
    expect(g1.result).toBe("1-0");
  });

  it("includes displayWhite and displayBlack in response", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    const g1 = res.body.find((g: any) => g.gameId === "a1");
    expect(g1.displayWhite).toBe("Alice D.");
    expect(g1.displayBlack).toBe("Bob D.");
    const g2 = res.body.find((g: any) => g.gameId === "a2");
    expect(g2.displayWhite).toBe("Charlie D.");
    expect(g2.displayBlack).toBe("Alice D.");
  });

  it("includes createdAt field in response", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    expect(res.body[0].createdAt).toBeDefined();
  });

  it("returns empty array for unknown player", async () => {
    const res = await request(app).get("/api/games?player=Unknown");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns games sorted by createdAt descending", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    if (res.body.length >= 2) {
      const dates = res.body.map((g: any) => new Date(g.createdAt).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    }
  });

  it("limits results to 100", async () => {
    const bulkGames = Array.from({ length: 110 }, (_, i) => ({
      gameId: `bulk-${i}`,
      moves: ["e4"],
      playerWhite: "BulkPlayer",
      playerBlack: "Opponent",
    }));
    await Game.insertMany(bulkGames);

    const res = await request(app).get("/api/games?player=BulkPlayer");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(100);
  });

  it("does not include startFen in list response", async () => {
    const res = await request(app).get("/api/games?player=Alice");
    expect(res.status).toBe(200);
    for (const g of res.body) {
      expect(g).not.toHaveProperty("startFen");
    }
  });
});
