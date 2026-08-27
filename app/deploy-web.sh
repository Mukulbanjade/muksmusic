#!/usr/bin/env bash
# Build the muksmusic web app and deploy it to Vercel (production).
# Usage:  ./deploy-web.sh
set -e

cd "$(dirname "$0")"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

echo "▸ Exporting web build…"
rm -rf dist
npx expo export --platform web --output-dir dist

echo "▸ Fixing font paths (Vercel strips node_modules)…"
node scripts-fix-web-fonts.mjs

echo "▸ Staging + deploying to Vercel…"
STAGE="$(mktemp -d)/muksmusic"
mkdir -p "$STAGE"
cp -R dist/. "$STAGE"/
cat > "$STAGE/vercel.json" <<'JSON'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/((?!_expo|assets|favicon|metadata).*)", "destination": "/index.html" }]
}
JSON
( cd "$(dirname "$STAGE")" && npx --yes vercel deploy muksmusic --prod --yes )

echo "▸ Done. Live at https://muksmusic-mukulbanjades-projects.vercel.app"
