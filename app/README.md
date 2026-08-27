# muksmusic (iOS app)

Expo / React Native app. Spotify-like UI, local library, offline playback.

## Prerequisites

- Node 18+
- Xcode (for `expo run:ios`)
- The [`../server`](../server) running on your Mac

## Run

```bash
npm install
npx expo run:ios     # build & install to simulator or a connected iPhone
```

For a physical iPhone, plug it in, trust the Mac, select it in Xcode's device
list (or let `expo run:ios --device` prompt you), and make sure the phone is on
the **same Wi-Fi** as the Mac running the server.

Then in the app: **Settings → server URL →** your Mac's LAN IP + `:8787`.

## Project layout

```
src/
  api/server.ts            HTTP client for muksmusic-server + saved server URL
  db/database.ts           expo-sqlite schema and queries (tracks, playlists)
  lib/download.ts          downloads audio+art to the device, records the track
  lib/format.ts            duration / byte formatting helpers
  context/
    LibraryContext.tsx     library state: tracks, playlists, likes, downloads
    PlayerContext.tsx      expo-audio playback engine (queue, repeat, shuffle)
  components/
    Artwork.tsx            local/remote art with gradient placeholder
    TrackRow.tsx           a song row
    MiniPlayer.tsx         floating now-playing bar above the tabs
    TrackOptionsModal.tsx  like / add-to-playlist / delete sheet
    AddToPlaylistModal.tsx pick or create a playlist
  screens/
    HomeScreen.tsx         greeting, quick access, recently added
    SearchScreen.tsx       search the server, download results
    LibraryScreen.tsx      songs, playlists, Liked Songs
    PlaylistDetailScreen.tsx  a playlist or the Liked Songs list
    NowPlayingScreen.tsx   full-screen player with scrubber
    SettingsScreen.tsx     server URL, connection test, storage usage
  navigation/RootNavigator.tsx   tabs + stack + modal
```

## Where songs are stored

- Audio → `<app documents>/audio/<id>.m4a`
- Artwork → `<app documents>/art/<id>.jpg`
- Metadata → `muksmusic.db` (expo-sqlite)

Deleting a song from its **⋯** menu removes the files and the database row.

## Notes

- `app.json` enables `UIBackgroundModes: audio` (background playback) and
  `NSAllowsArbitraryLoads` (so the app can reach your `http://` LAN server).
- New Architecture is enabled (`newArchEnabled: true`).
