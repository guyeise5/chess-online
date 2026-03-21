#!/bin/sh
set -e

BUNDLED_ZST="/app/bundled/lichess_db_puzzle.csv.zst"
WORK_ZST="/tmp/lichess_db_puzzle.csv.zst"
WORK_CSV="/tmp/lichess_db_puzzle.csv"

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

echo "Using bundled puzzle database from image."
cp "$BUNDLED_ZST" "$WORK_ZST"

echo "Decompressing..."
zstd -d "$WORK_ZST" -o "$WORK_CSV" --rm

echo "Importing puzzles into MongoDB..."
CSV_PATH="$WORK_CSV" node dist/scripts/import-puzzles.js

rm -f "$WORK_CSV"
echo "Puzzle import complete."
