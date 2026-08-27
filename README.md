# muksmusic 🎵

Your own personal, Spotify-like music app for **iPhone** — search for any song,
download it, and keep it **stored locally on your phone** so your whole library
plays fully offline.

Inspired by [playarr](https://github.com/strayfade/playarr), rebuilt small and
personal.

---

## How it works (and why there are two parts)

iOS does not allow a yt-dlp–style scraper to run on the device itself, so
muksmusic is split into two pieces:

```
┌─────────────────────┐        Wi-Fi (LAN)        ┌──────────────────────────┐
│  muksmusic (iPhone) │  ──── search / download ──▶│  muksmusic-server (Mac)  │
│  Expo / React Native│                            │  Node + yt-dlp           │
│  • local SQLite DB  │◀──── audio bytes ──────────│  • searches YouTube      │
│  • local audio files│                            │  • streams m4a audio     │
│  • offline playback │                            └──────────────────────────┘
└─────────────────────┘
```

- **`server/`** — a tiny Node backend that runs on your Mac. It uses `yt-dlp`
  to search and to stream audio. Nothing is stored here; it's just the scraper.
- **`app/`** — the iOS app. When you download a song, the audio bytes are saved
  into the app's own storage on the phone and recorded in a local database.
  After that, the song plays **without** the server or any internet.

You only need the server running **while downloading**. Playback is always offline.

> `playarr-reference/` is the original Playarr repo, kept only for reference.

---

## Quick start

### 1. Start the server (on your Mac)

```bash
cd server
npm start
```

It prints the address to use, e.g. `http://192.168.1.20:8787`.

`yt-dlp` is bundled as a fallback, but for fast startup install the Homebrew
build once:

```bash
brew install yt-dlp
```

### 2. Run the app (on your iPhone)

```bash
cd app
npm install
npx expo run:ios        # builds & installs to a connected iPhone / simulator
```

(You can also run `npx expo start` and open it with a dev build.)

### 3. Connect the app to the server

Open the app → **Home → ⚙︎ Settings** → enter the server address the server
printed (your Mac's LAN IP + `:8787`) → **Save & test connection**.

The Mac and iPhone must be on the **same Wi-Fi network**.

### 4. Use it

- **Search** → type a song → tap ⬇︎ to download it to your phone.
- **Library** → your downloaded songs, playlists, and Liked Songs.
- Tap any song to play; tap the mini-player to open the full Now Playing screen.

---

## Notes

- Audio is downloaded as `m4a` (AAC) — no ffmpeg required.
- Everything lives on the phone; deleting a song removes its file.
- This is a personal tool. Only download content you have the right to.

See [`server/README.md`](server/README.md) and [`app/README.md`](app/README.md)
for details on each part.
