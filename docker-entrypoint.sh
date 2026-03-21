#!/bin/sh
cat <<EOF > /app/public/env-config.js
window.__ENV__={AUTHOR_URL:"${AUTHOR_URL:-}"};
EOF
exec "$@"
