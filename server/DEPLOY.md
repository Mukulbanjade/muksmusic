# Hosting muksmusic-server (so it runs without your Mac)

The server is a container: pure Node + a bundled `yt-dlp`. Any host that runs a
Docker container 24/7 works. Fly.io is the smoothest (deploys this folder
directly, no GitHub repo needed).

## Option A — Fly.io (recommended)

1. Install the CLI and sign in (one time):
   ```bash
   brew install flyctl
   fly auth signup     # or: fly auth login
   ```
2. From this folder, launch (it reads the Dockerfile + fly.toml):
   ```bash
   cd ~/Developer/muksmusic/server
   fly launch --copy-config --now
   ```
   Accept the defaults. It builds the image and deploys. When it finishes it
   prints your URL, e.g. `https://muksmusic-server-xxxx.fly.dev`.
3. Test it:
   ```bash
   curl https://<your-app>.fly.dev/health
   ```
   You want `{"ok":true,"ytDlp":"..."}`.
4. In the muksmusic app → **Settings** → set the server URL to that `https://…fly.dev`
   address → **Save & test**. Done — the app now works with your Mac off.

Redeploy after code changes: `fly deploy`.

## Option B — Render / Railway

Push this repo to GitHub, create a new **Web Service** (Render) or project
(Railway) from it, point it at `server/`, and it builds the Dockerfile
automatically. Render's free tier sleeps after 15 min idle (slow first request).

---

## If YouTube blocks the server ("Sign in to confirm you're not a bot")

Cloud IPs get bot-checked by YouTube. The fix is to give yt-dlp a logged-in
session via a cookies file:

1. In a browser logged into YouTube, export cookies with the
   **"Get cookies.txt LOCALLY"** extension → save as `cookies.txt`.
2. Put it in this folder (`server/cookies.txt`) and add this line to the
   `Dockerfile` right after the `COPY package.json ./` line:
   ```dockerfile
   COPY cookies.txt ./cookies.txt
   ```
   The server auto-detects `cookies.txt` (or the `YTDLP_COOKIES` env var).
3. `fly deploy` again.

Cookies expire every so often; re-export and redeploy when downloads start
failing. **Use a throwaway Google account** — automated downloading can get an
account limited.

## The most reliable option (no bot-checks at all)

Run this same server on a **device at home** (a Raspberry Pi or any spare
computer left on) with `npm start`. A home/residential IP isn't bot-checked, so
YouTube just works — no cookies needed. That's the trade: cloud = convenient but
needs cookies; home device = rock-solid but you supply the always-on hardware.
