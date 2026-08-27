# muksmusic-server

The scraping backend for the muksmusic iOS app. Pure Node (no npm
dependencies) — it shells out to `yt-dlp` on your Mac.

## Run

```bash
npm start            # listens on 0.0.0.0:8787 by default
```

Override the port with `PORT=9000 npm start`.

On first launch it prints the LAN address to enter in the app's Settings.

## yt-dlp

The server looks for `yt-dlp` in this order:

1. `YT_DLP_PATH` env var
2. Homebrew / pip install at `/usr/local/bin/yt-dlp` or `/opt/homebrew/bin/yt-dlp` (**recommended — starts in ~1s**)
3. The self-contained binary vendored at `server/bin/yt-dlp` (works with zero
   setup, but macOS re-scans it on every launch which is slow)

Install the fast one once:

```bash
brew install yt-dlp
```

## Endpoints

| Method | Path        | Purpose                                             |
| ------ | ----------- | --------------------------------------------------- |
| GET    | `/health`   | `{ ok, ytDlp }` — connection + yt-dlp version check |
| GET    | `/search`   | `?q=<query>&limit=<n>` → `{ tracks: [...] }`         |
| GET    | `/download` | `?id=<youtubeId>` → streams `audio/mp4` bytes        |
| GET    | `/art`      | `?url=<imageUrl>` → proxies cover artwork            |

Each search track: `{ id, title, artist, durationMs, artworkUrl, source }`.

## Security

This server is meant to run on your **local network only**. It has no auth. Do
not expose it to the public internet.
