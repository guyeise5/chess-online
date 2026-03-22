import fs from "fs";
import readline from "readline";
import mongoose from "mongoose";
import { Chess } from "chess.js";
import BookPosition from "../models/BookPosition";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chess-online";
const TSV_DIR = process.env.TSV_DIR || "/app/bundled/openings";
const BATCH_SIZE = 5000;
const TSV_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"];

function positionKey(fen: string): string {
  const parts = fen.split(" ");
  return parts.slice(0, 4).join(" ");
}

function parsePgn(pgn: string): string[] {
  return pgn
    .replace(/\d+\.\s*/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

async function importOpenings() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await BookPosition.estimatedDocumentCount();
  if (existing > 0) {
    console.log(
      `Book positions collection already has ${existing} documents, skipping import.`
    );
    await mongoose.disconnect();
    return;
  }

  const fenSet = new Set<string>();
  let lines = 0;
  let errors = 0;

  for (const file of TSV_FILES) {
    const filePath = `${TSV_DIR}/${file}`;
    if (!fs.existsSync(filePath)) {
      console.warn(`TSV file not found: ${filePath}, skipping.`);
      continue;
    }

    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let isHeader = true;

    for await (const line of rl) {
      if (isHeader) {
        isHeader = false;
        continue;
      }

      const parts = line.split("\t");
      if (parts.length < 3) continue;

      const pgn = parts[2];
      const sans = parsePgn(pgn);
      if (sans.length === 0) continue;

      try {
        const game = new Chess();
        fenSet.add(positionKey(game.fen()));
        for (const san of sans) {
          const m = game.move(san);
          if (!m) break;
          fenSet.add(positionKey(game.fen()));
        }
        lines++;
      } catch {
        errors++;
      }
    }
  }

  console.log(
    `Parsed ${lines} opening lines, ${fenSet.size} unique positions, ${errors} errors.`
  );

  let batch: { fen: string }[] = [];
  let total = 0;

  for (const fen of fenSet) {
    batch.push({ fen });
    if (batch.length >= BATCH_SIZE) {
      await BookPosition.insertMany(batch, { ordered: false });
      total += batch.length;
      process.stdout.write(`\rInserted ${total} positions...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await BookPosition.insertMany(batch, { ordered: false });
    total += batch.length;
  }

  console.log(`\nDone! Imported ${total} book positions.`);
  console.log("Creating indexes...");
  await BookPosition.ensureIndexes();
  console.log("Indexes ready.");

  await mongoose.disconnect();
}

importOpenings().catch((err) => {
  console.error("Opening import failed:", err);
  process.exit(1);
});
