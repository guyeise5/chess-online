import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { GameManager } from "./game/GameManager";
import { registerSocketHandlers } from "./socket/handlers";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chess-online";

const app = express();
app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname, "..", "public");
app.use(express.static(staticPath));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
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

  const gm = new GameManager(io);
  registerSocketHandlers(io, gm);

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
      await mongoose.connection.db!.admin().ping();
      res.json({ status: "ready", mongo: "connected" });
    } catch (err) {
      res.status(503).json({ status: "not ready", error: String(err) });
    }
  });

  app.get("/api/puzzles/random", async (req, res) => {
    try {
      const rating = parseInt(req.query.rating as string, 10) || 1500;
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

  if (process.env.FEATURE_GAME_STORAGE !== "false") {
    const Game = (await import("./models/Game")).default;

    app.post("/api/games/:gameId", async (req, res) => {
      try {
        const { gameId } = req.params;
        const { moves, startFen, playerWhite, playerBlack, orientation } = req.body;
        if (!Array.isArray(moves) || moves.length === 0) {
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
          { gameId, moves: validMoves, startFen, playerWhite, playerBlack, orientation },
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
          orientation: game.orientation,
        });
      } catch (err) {
        console.error("Game fetch error:", err);
        res.status(500).json({ error: "Failed to fetch game" });
      }
    });
  }

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
