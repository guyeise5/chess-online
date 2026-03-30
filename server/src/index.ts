import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { GameManager } from "./game/GameManager";
import { registerSocketHandlers } from "./socket/handlers";
import { setIndexHtmlNoCacheHeaders } from "./staticIndexHeaders";
import { setupSamlAuth, requireAuth, getSessionUserId, getSessionDisplayName } from "./auth/samlAuth";

dotenv.config();

const PORT = parseInt(process.env["PORT"] || "3001", 10);
const MONGO_URI = process.env["MONGO_URI"] || "mongodb://localhost:27017/chess-online";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const staticPath = path.join(__dirname, "..", "public");
app.use(
  express.static(staticPath, {
    setHeaders(res, filepath) {
      if (path.basename(filepath) === "index.html") {
        setIndexHtmlNoCacheHeaders(res);
      }
    },
  }),
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env["CLIENT_ORIGIN"] || "*",
    methods: ["GET", "POST"],
  },
});

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }

  const samlEnabled = process.env["FEATURE_SAML_AUTH"] === "true";

  if (samlEnabled) {
    const { sessionMiddleware } = setupSamlAuth(app, MONGO_URI);
    io.engine.use(sessionMiddleware);
    app.use(requireAuth());
  }

  const gm = new GameManager(io);
  registerSocketHandlers(io, gm, samlEnabled);

  const Puzzle = (await import("./models/Puzzle")).default;

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    try {
      const state = mongoose.connection.readyState;
      if (state !== 1) {
        res.status(503).json({ status: "not ready", mongo: "disconnected" });
        return;
      }
      const db = mongoose.connection.db;
      if (!db) { res.status(503).json({ status: "not ready", mongo: "db not available" }); return; }
      await db.admin().ping();
      res.json({ status: "ready", mongo: "connected" });
    } catch (err) {
      res.status(503).json({ status: "not ready", error: String(err) });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!samlEnabled) {
        res.status(404).json({ error: "Auth not enabled" });
        return;
      }
      const user = req.user as { userId?: string; displayName?: string; firstName?: string; lastName?: string } | undefined;
      if (!user || typeof user.userId !== "string" || !user.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const result: Record<string, unknown> = {
        userId: user.userId,
        displayName: user.displayName ?? user.userId,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
      };

      if (process.env["FEATURE_USER_PREFERENCES"] !== "false") {
        const UserPreferences = (await import("./models/UserPreferences")).default;
        const doc = await UserPreferences.findOne({ userId: user.userId }).lean();
        if (doc) {
          result["preferences"] = {
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
          };
        }
      }

      res.json(result);
    } catch (err) {
      console.error("Auth me error:", err);
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });

  app.get("/api/puzzles/random", async (req, res) => {
    try {
      let rating = 1500;
      if (samlEnabled) {
        const sessionUid = getSessionUserId(req);
        if (sessionUid) {
          const UP = (await import("./models/UserPreferences")).default;
          const prefs = await UP.findOne({ userId: sessionUid }).lean();
          if (prefs && typeof prefs.puzzleRating === "number" && Number.isFinite(prefs.puzzleRating)) {
            rating = prefs.puzzleRating;
          }
        }
      } else {
        const ratingParam = Array.isArray(req.query["rating"]) ? req.query["rating"][0] : req.query["rating"];
        const parsed = parseInt(String(ratingParam ?? ""), 10);
        if (Number.isFinite(parsed)) rating = parsed;
      }
      const range = 15;
      const min = rating - range;
      const max = rating + range;

      const filter = { rating: { $gte: min, $lte: max } };
      const count = await Puzzle.countDocuments(filter);
      const p = count > 0
        ? await Puzzle.findOne(filter).skip(Math.floor(Math.random() * count)).lean()
        : null;

      if (!p) {
        res.status(404).json({ error: "No puzzles found in rating range" });
        return;
      }

      res.json({
        puzzleId: p.puzzleId,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        themes: p.themes,
      });
    } catch (err) {
      console.error("Puzzle fetch error:", err);
      res.status(500).json({ error: "Failed to fetch puzzle" });
    }
  });

  app.get("/api/puzzles/:puzzleId", async (req, res) => {
    try {
      const p = await Puzzle.findOne({ puzzleId: req.params.puzzleId }).lean();
      if (!p) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }
      res.json({
        puzzleId: p.puzzleId,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        themes: p.themes,
      });
    } catch (err) {
      console.error("Puzzle fetch error:", err);
      res.status(500).json({ error: "Failed to fetch puzzle" });
    }
  });

  if (process.env["FEATURE_OPENING_BOOK"] !== "false") {
    const BookPosition = (await import("./models/BookPosition")).default;

    app.post("/api/openings/check", async (req, res) => {
      try {
        if (!req.body || typeof req.body !== "object") { res.status(400).json({ error: "Invalid body" }); return; }
        const { fens } = req.body;
        if (!Array.isArray(fens) || fens.length === 0 || !fens.every((f: unknown) => typeof f === "string")) {
          res.status(400).json({ error: "fens array is required" });
          return;
        }

        const found = await BookPosition.find(
          { fen: { $in: fens } },
          { fen: 1, _id: 0 }
        ).lean();
        const bookSet = new Set(found.map((d) => d.fen));
        const book = fens.map((f: string) => bookSet.has(f));
        res.json({ book });
      } catch (err) {
        console.error("Opening book check error:", err);
        res.status(500).json({ error: "Failed to check opening book" });
      }
    });
  }

  if (process.env["FEATURE_GAME_STORAGE"] !== "false") {
    const Game = (await import("./models/Game")).default;

    app.post("/api/games/:gameId", async (req, res) => {
      try {
        const { gameId } = req.params;
        if (!req.body || typeof req.body !== "object") { res.status(400).json({ error: "Invalid body" }); return; }

        let { playerWhite, playerBlack, displayWhite, displayBlack } = req.body;
        const { moves, startFen, orientation, result } = req.body;

        if (samlEnabled) {
          const sessionUid = getSessionUserId(req);
          if (!sessionUid) { res.status(403).json({ error: "Forbidden" }); return; }
          const sessionDisplay = getSessionDisplayName(req) ?? sessionUid;
          const ori = typeof orientation === "string" ? orientation : "white";
          if (ori === "white") {
            playerWhite = sessionUid;
            displayWhite = sessionDisplay;
          } else {
            playerBlack = sessionUid;
            displayBlack = sessionDisplay;
          }
        }

        if (!Array.isArray(moves) || moves.length === 0 || !moves.every((m: unknown) => typeof m === "string")) {
          res.status(400).json({ error: "moves array is required" });
          return;
        }

        const { validateMoves } = await import("./utils/validateMoves");
        const { validMoves, truncated } = validateMoves(moves, startFen);

        if (validMoves.length === 0) {
          res.status(400).json({ error: "No valid moves in the sequence" });
          return;
        }

        if (truncated) {
          console.warn(
            `Game ${gameId}: truncated ${moves.length} moves to ${validMoves.length} valid moves`
          );
        }

        await Game.findOneAndUpdate(
          { gameId },
          {
            gameId, moves: validMoves, startFen,
            playerWhite, playerBlack,
            displayWhite: typeof displayWhite === "string" ? displayWhite : playerWhite,
            displayBlack: typeof displayBlack === "string" ? displayBlack : playerBlack,
            orientation, result,
          },
          { upsert: true, new: true }
        );
        res.json({ ok: true, totalMoves: moves.length, savedMoves: validMoves.length });
      } catch (err) {
        console.error("Game save error:", err);
        res.status(500).json({ error: "Failed to save game" });
      }
    });

    app.get("/api/games/:gameId", async (req, res) => {
      try {
        const game = await Game.findOne({ gameId: req.params.gameId }).lean();
        if (!game) {
          res.status(404).json({ error: "Game not found" });
          return;
        }
        res.json({
          gameId: game.gameId,
          moves: game.moves,
          startFen: game.startFen,
          playerWhite: game.playerWhite,
          playerBlack: game.playerBlack,
          displayWhite: game.displayWhite ?? game.playerWhite,
          displayBlack: game.displayBlack ?? game.playerBlack,
          orientation: game.orientation,
          result: game.result,
        });
      } catch (err) {
        console.error("Game fetch error:", err);
        res.status(500).json({ error: "Failed to fetch game" });
      }
    });

    if (process.env["FEATURE_GAME_HISTORY"] !== "false") {
      app.get("/api/games", async (req, res) => {
        try {
          const playerParam = Array.isArray(req.query["player"]) ? req.query["player"][0] : req.query["player"];
          const player = typeof playerParam === "string" ? playerParam : "";
          if (!player) {
            res.status(400).json({ error: "player query parameter is required" });
            return;
          }
          if (samlEnabled) {
            const sessionUid = getSessionUserId(req);
            if (!sessionUid || sessionUid !== player) {
              res.status(403).json({ error: "Forbidden" });
              return;
            }
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
          console.error("Game list error:", err);
          res.status(500).json({ error: "Failed to list games" });
        }
      });
    }
  }

  if (process.env["FEATURE_USER_PREFERENCES"] !== "false") {
    const UserPreferences = (await import("./models/UserPreferences")).default;

    app.get("/api/preferences/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        if (!userId || typeof userId !== "string") {
          res.status(400).json({ error: "userId is required" });
          return;
        }
        if (samlEnabled) {
          const sessionUid = getSessionUserId(req);
          if (!sessionUid || sessionUid !== userId) {
            res.status(403).json({ error: "Forbidden" });
            return;
          }
        }
        const doc = await UserPreferences.findOne({ userId }).lean();
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

    app.put("/api/preferences/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        if (!userId || typeof userId !== "string") {
          res.status(400).json({ error: "userId is required" });
          return;
        }
        if (samlEnabled) {
          const sessionUid = getSessionUserId(req);
          if (!sessionUid || sessionUid !== userId) {
            res.status(403).json({ error: "Forbidden" });
            return;
          }
        }
        if (!req.body || typeof req.body !== "object") {
          res.status(400).json({ error: "Invalid body" });
          return;
        }

        const allowed = [
          "introSeen", "locale", "boardTheme", "pieceSet", "lobbyColor",
          "customMinIdx", "customIncIdx", "computerColor",
          "puzzleRating", "puzzleCount",
        ] as const;

        const update: Record<string, unknown> = {};
        for (const key of allowed) {
          if (key in req.body) {
            if (key === "locale") {
              const v = req.body["locale"];
              if (v === "en" || v === "he") {
                update[key] = v;
              }
            } else {
              update[key] = req.body[key];
            }
          }
        }

        if (Object.keys(update).length === 0) {
          res.status(400).json({ error: "No valid fields to update" });
          return;
        }

        await UserPreferences.findOneAndUpdate(
          { userId },
          { $set: update },
          { upsert: true, new: true }
        );
        res.json({ ok: true });
      } catch (err) {
        console.error("Preferences update error:", err);
        res.status(500).json({ error: "Failed to update preferences" });
      }
    });
  }

  if (process.env["FEATURE_STATS"] !== "false") {
    const Room = (await import("./models/Room")).default;

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
        console.error("Stats fetch error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
      }
    });
  }

  app.get("*", (_req, res) => {
    setIndexHtmlNoCacheHeaders(res);
    res.sendFile(path.join(staticPath, "index.html"));
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
