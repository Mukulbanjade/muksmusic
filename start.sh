#!/usr/bin/env bash
# muksmusic — start the scraping server + the Expo dev server (for phone/web).
# Run:  ./start.sh        then scan the QR with your iPhone (Expo Go).
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# 1. Music/scraping server (yt-dlp) on :8787
( cd "$ROOT/server" && PORT=8787 node src/index.js ) &
SERVER_PID=$!

# 2. Expo dev server on :8081 (serves the phone via Expo Go, and web)
( cd "$ROOT/app" && npx expo start ) &
EXPO_PID=$!

echo ""
echo "muksmusic is starting:"
echo "  • scraping server : http://$(ipconfig getifaddr en0 2>/dev/null || echo localhost):8787"
echo "  • Expo (phone/web): scan the QR above in Expo Go, or press 'w' for web"
echo ""
echo "In the app: Settings → set server URL to http://<this-mac-ip>:8787"
echo "Press Ctrl+C to stop both."

trap "kill $SERVER_PID $EXPO_PID 2>/dev/null" EXIT
wait
