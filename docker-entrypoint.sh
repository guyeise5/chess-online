#!/bin/sh
cat <<EOF > /app/public/env-config.js
window.__ENV__={AUTHOR_URL:"${AUTHOR_URL:-}",FEATURE_GAME_STORAGE:"${FEATURE_GAME_STORAGE:-true}",FEATURE_MATERIAL_DIFF:"${FEATURE_MATERIAL_DIFF:-true}"};
EOF
exec "$@"
