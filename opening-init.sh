#!/bin/sh
set -e

echo "Checking if book positions are already imported..."
NEEDS_IMPORT=$(node -e "
  const mongoose = require('mongoose');
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const count = await mongoose.connection.db.collection('bookpositions').estimatedDocumentCount();
    console.log(count > 0 ? 'no' : 'yes');
    await mongoose.disconnect();
  })().catch(() => { console.log('yes'); process.exit(0); });
")

if [ "$NEEDS_IMPORT" = "no" ]; then
  echo "Book positions already imported, nothing to do."
  exit 0
fi

echo "Importing opening book into MongoDB..."
TSV_DIR="/app/bundled/openings" node dist/scripts/import-openings.js

echo "Opening book import complete."
