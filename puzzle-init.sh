#!/bin/sh
set -e

DATA_DIR="/data"
CSV_FILE="$DATA_DIR/lichess_db_puzzle.csv"
ZST_FILE="$DATA_DIR/lichess_db_puzzle.csv.zst"

echo "Checking if puzzles are already imported..."
NEEDS_IMPORT=$(node -e "
  const mongoose = require('mongoose');
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await mongoose.connection.db.collection('puzzles').estimatedDocumentCount();
    console.log(count > 0 ? 'no' : 'yes');
    await mongoose.disconnect();
  })().catch(() => { console.log('yes'); process.exit(0); });
")

if [ "$NEEDS_IMPORT" = "no" ]; then
  echo "Puzzles already imported, nothing to do."
  exit 0
fi

if [ ! -f "$CSV_FILE" ] && [ -f "$ZST_FILE" ]; then
  echo "Decompressing $ZST_FILE..."
  zstd -d "$ZST_FILE" -o "$CSV_FILE" --keep
fi

if [ ! -f "$CSV_FILE" ]; then
  echo "ERROR: No puzzle file found. Place lichess_db_puzzle.csv or lichess_db_puzzle.csv.zst in the data/ directory."
  echo "Download from: https://database.lichess.org/#puzzles"
  exit 1
fi

echo "Importing puzzles into MongoDB..."
CSV_PATH="$CSV_FILE" node dist/scripts/import-puzzles.js
echo "Puzzle import complete."
