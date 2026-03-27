import express from "express";
import request from "supertest";
import UserPreferences from "../models/UserPreferences";
import { setupDB, teardownDB, clearDB } from "./setup";

const ALLOWED_KEYS = [
  "introSeen",
  "locale",
  "boardTheme",
  "pieceSet",
  "lobbyColor",
  "customMinIdx",
  "customIncIdx",
  "computerColor",
  "puzzleRating",
  "puzzleCount",
] as const;

type PreferencePayload = {
  introSeen: boolean;
  locale: string;
  boardTheme: string;
  pieceSet: string;
  lobbyColor: string;
  customMinIdx: number;
  customIncIdx: number;
  computerColor: string;
  puzzleRating: number;
  puzzleCount: number;
};

function isPreferencePayload(value: unknown): value is PreferencePayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.introSeen === "boolean" &&
    (o.locale === "en" || o.locale === "he") &&
    typeof o.boardTheme === "string" &&
    typeof o.pieceSet === "string" &&
    typeof o.lobbyColor === "string" &&
    typeof o.customMinIdx === "number" &&
    typeof o.customIncIdx === "number" &&
    typeof o.computerColor === "string" &&
    typeof o.puzzleRating === "number" &&
    typeof o.puzzleCount === "number"
  );
}

let app: express.Application;

beforeAll(setupDB);

beforeAll(() => {
  app = express();
  app.use(express.json());

  app.get("/api/preferences/:playerName", async (req, res) => {
    try {
      const { playerName } = req.params;
      if (!playerName || typeof playerName !== "string") {
        res.status(400).json({ error: "playerName is required" });
        return;
      }
      const doc = await UserPreferences.findOne({ playerName }).lean();
      if (!doc) {
        res.status(404).json({ error: "Preferences not found" });
        return;
      }
      res.json({
        introSeen: doc.introSeen,
        locale: doc.locale === "he" ? "he" : "en",
        boardTheme: doc.boardTheme,
        pieceSet: doc.pieceSet,
        lobbyColor: doc.lobbyColor,
        customMinIdx: doc.customMinIdx,
        customIncIdx: doc.customIncIdx,
        computerColor: doc.computerColor,
        puzzleRating: doc.puzzleRating,
        puzzleCount: doc.puzzleCount,
      });
    } catch (err) {
      console.error("Preferences fetch error:", err);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put("/api/preferences/:playerName", async (req, res) => {
    try {
      const { playerName } = req.params;
      if (!playerName || typeof playerName !== "string") {
        res.status(400).json({ error: "playerName is required" });
        return;
      }
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({ error: "Invalid body" });
        return;
      }

      const update: Record<string, unknown> = {};
      for (const key of ALLOWED_KEYS) {
        if (key in req.body) {
          if (key === "locale") {
            const v = (req.body as Record<string, unknown>)["locale"];
            if (v === "en" || v === "he") {
              update[key] = v;
            }
          } else {
            update[key] = (req.body as Record<string, unknown>)[key];
          }
        }
      }

      if (Object.keys(update).length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
      }

      await UserPreferences.findOneAndUpdate(
        { playerName },
        { $set: update },
        { upsert: true, new: true }
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("Preferences update error:", err);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("GET /api/preferences/:playerName", () => {
  it("returns 404 for non-existent player", async () => {
    const res = await request(app).get("/api/preferences/no-such-player");
    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
    expect(typeof res.body.error).toBe("string");
  });

  it("returns all defaults after document exists with only playerName", async () => {
    await UserPreferences.create({ playerName: "defaults-only" });

    const res = await request(app).get("/api/preferences/defaults-only");
    expect(res.status).toBe(200);
    expect(isPreferencePayload(res.body)).toBe(true);
    if (!isPreferencePayload(res.body)) return;

    expect(res.body).toEqual({
      introSeen: false,
      locale: "en",
      boardTheme: "brown",
      pieceSet: "cburnett",
      lobbyColor: "random",
      customMinIdx: 7,
      customIncIdx: 3,
      computerColor: "white",
      puzzleRating: 1500,
      puzzleCount: 0,
    });
  });
});

describe("PUT /api/preferences/:playerName", () => {
  it("creates preferences via upsert, then GET returns them", async () => {
    const putRes = await request(app)
      .put("/api/preferences/new-player")
      .send({ introSeen: true, boardTheme: "blue" });

    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual({ ok: true });
    expect(typeof putRes.body.ok).toBe("boolean");
    expect(putRes.body.ok).toBe(true);

    const getRes = await request(app).get("/api/preferences/new-player");
    expect(getRes.status).toBe(200);
    expect(isPreferencePayload(getRes.body)).toBe(true);
    if (!isPreferencePayload(getRes.body)) return;

    expect(getRes.body.introSeen).toBe(true);
    expect(getRes.body.boardTheme).toBe("blue");
    expect(getRes.body.pieceSet).toBe("cburnett");
  });

  it("partial update merges fields across PUTs", async () => {
    await request(app).put("/api/preferences/merge-user").send({ introSeen: true });
    await request(app).put("/api/preferences/merge-user").send({ boardTheme: "green" });

    const getRes = await request(app).get("/api/preferences/merge-user");
    expect(getRes.status).toBe(200);
    expect(isPreferencePayload(getRes.body)).toBe(true);
    if (!isPreferencePayload(getRes.body)) return;

    expect(getRes.body.introSeen).toBe(true);
    expect(getRes.body.boardTheme).toBe("green");
  });

  it("ignores unknown fields", async () => {
    const putRes = await request(app)
      .put("/api/preferences/ignore-extra")
      .send({
        puzzleRating: 1600,
        hackerField: "nope",
        extra: { nested: true },
      });

    expect(putRes.status).toBe(200);

    const raw = await UserPreferences.findOne({ playerName: "ignore-extra" }).lean();
    expect(raw).not.toBeNull();
    if (!raw) return;
    expect("hackerField" in raw).toBe(false);
    expect("extra" in raw).toBe(false);
    expect(raw.puzzleRating).toBe(1600);
  });

  it("returns 400 for empty body or no valid fields", async () => {
    const emptyObj = await request(app).put("/api/preferences/bad-body").send({});
    expect(emptyObj.status).toBe(400);
    expect(emptyObj.body).toEqual(
      expect.objectContaining({ error: expect.any(String) })
    );

    const unknownOnly = await request(app)
      .put("/api/preferences/bad-body-2")
      .send({ unknown: 1, alsoBad: "x" });
    expect(unknownOnly.status).toBe(400);
    expect(typeof unknownOnly.body.error).toBe("string");
  });

  it("concurrent PUTs for different players do not interfere", async () => {
    await Promise.all([
      request(app).put("/api/preferences/p-a").send({ puzzleRating: 1000 }),
      request(app).put("/api/preferences/p-b").send({ puzzleRating: 2000 }),
    ]);

    const [aRes, bRes] = await Promise.all([
      request(app).get("/api/preferences/p-a"),
      request(app).get("/api/preferences/p-b"),
    ]);

    expect(aRes.status).toBe(200);
    expect(bRes.status).toBe(200);
    expect(isPreferencePayload(aRes.body)).toBe(true);
    expect(isPreferencePayload(bRes.body)).toBe(true);
    if (!isPreferencePayload(aRes.body) || !isPreferencePayload(bRes.body)) return;

    expect(aRes.body.puzzleRating).toBe(1000);
    expect(bRes.body.puzzleRating).toBe(2000);
  });
});
