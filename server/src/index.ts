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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/puzzles/random", async (req, res) => {
    try {
      const rating = parseInt(req.query.rating as string, 10) || 1500;
      const range = 200;

      const puzzles = await Puzzle.aggregate([
        { $match: { rating: { $gte: rating - range, $lte: rating + range } } },
        { $sample: { size: 1 } },
      ]);

      if (puzzles.length === 0) {
        res.status(404).json({ error: "No puzzles found in rating range" });
        return;
      }

      const p = puzzles[0];
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

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
