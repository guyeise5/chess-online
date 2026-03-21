import fs from "fs";
import readline from "readline";
import mongoose from "mongoose";
import Puzzle from "../models/Puzzle";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chess-online";
const CSV_PATH = process.env.CSV_PATH || "/tmp/lichess_db_puzzle.csv";
const BATCH_SIZE = 5000;
const MIN_POPULARITY = 0;

async function importPuzzles() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await Puzzle.estimatedDocumentCount();
  if (existing > 0) {
    console.log(`Puzzles collection already has ${existing} documents, skipping import.`);
    await mongoose.disconnect();
    return;
  }

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at ${CSV_PATH}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const stream = fs.createReadStream(CSV_PATH, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let batch: any[] = [];
  let total = 0;
  let skipped = 0;
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const fields = line.split(",");
    if (fields.length < 8) continue;

    const popularity = parseInt(fields[5], 10);
    if (popularity < MIN_POPULARITY) {
      skipped++;
      continue;
    }

    batch.push({
      puzzleId: fields[0],
      fen: fields[1],
      moves: fields[2].split(" "),
      rating: parseInt(fields[3], 10),
      ratingDeviation: parseInt(fields[4], 10),
      popularity: popularity,
      nbPlays: parseInt(fields[6], 10),
      themes: fields[7] ? fields[7].split(" ") : [],
      gameUrl: fields[8] || "",
      openingTags: fields[9] ? fields[9].split(" ") : [],
    });

    if (batch.length >= BATCH_SIZE) {
      await Puzzle.insertMany(batch, { ordered: false });
      total += batch.length;
      process.stdout.write(`\rImported ${total} puzzles...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await Puzzle.insertMany(batch, { ordered: false });
    total += batch.length;
  }

  console.log(`\nDone! Imported ${total} puzzles, skipped ${skipped} unpopular ones.`);
  console.log("Creating indexes...");
  await Puzzle.ensureIndexes();
  console.log("Indexes ready.");

  await mongoose.disconnect();
}

importPuzzles().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
