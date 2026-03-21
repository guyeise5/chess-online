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

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
