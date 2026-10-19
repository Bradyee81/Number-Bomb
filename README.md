# Number Bomb

A live stage/party number-guessing game. A "bomb" number is hidden inside a
1–99 range; players shout out numbers, an operator enters what was called,
and each call narrows the range from whichever side the bomb is on. Whoever
calls the exact bomb number "detonates" it. Nobody but the app knows where
the bomb actually is until it's hit.

Built as a standalone desktop app with a green-screen (chroma key) output
window, meant to be composited into a live show via OBS, vMix, or any video
switcher.

## Download

Windows builds are published on the [Releases page](https://github.com/Bradyee81/Number-Bomb/releases) — grab the `.msi` or `.exe` (NSIS setup) asset from the latest release.

## Features

- **Two-window setup:** a `Control` window for the operator (kept on your
  primary monitor) and an `Output` window for the video switcher's capture
  source, toggled fullscreen with one button.
- **Slot-machine style reels** for the current low/high bounds, with a
  landing animation on every call.
- **Explosion overlay** on a bomb hit — a swappable video clip layered over
  the reveal, with an automatic red-flash fallback if no video is set.
- **Center display** — a looping video (or a fallback icon) that turns into
  the actual bomb number when it's revealed.
- **Cantonese voiceover** for every called number (01–99), bundled with the
  app and regenerable with a different voice (see Development).
- **Configurable chroma key color**, explosion clip, center video/icon, reel
  digit-strip image, and bomb-reveal font — all swappable from the Settings
  screen, no rebuild required.
- **Single-level undo** for mis-entered calls, including reversing an
  explosion.
- Out-of-range call validation and a press-and-hold bomb reveal for the
  operator's own reference.

## Using it

1. Open the app — the **Control** window shows the Play screen.
2. Click **Present** to open the **Output** window fullscreen on your
   capture source/second display.
3. Click **Start Round** to begin. Type each called number and press Enter.
4. Click **Undo** to reverse the last call (works once, including reversing
   an explosion). **End Round** resets to idle; **Start Round** begins a new
   one with a fresh hidden bomb number.
5. Configure chroma color, explosion video, center video/icon, reel image,
   bomb-reveal font, and voiceover volume from the **Settings** screen —
   changes apply live, no restart needed.

## Development

Requires [Node.js](https://nodejs.org), [Rust](https://rustup.rs), and
Tauri's platform dependencies (see the
[Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev    # run in development
npm test              # run the game-logic unit tests
npm run tauri build   # produce a production build for your current platform
```

### Voiceover clips

The Cantonese number clips in `public/audio/01.mp3`…`99.mp3` are generated
with Microsoft neural TTS via [edge-tts](https://github.com/rany2/edge-tts).
To regenerate them (needs [uv](https://docs.astral.sh/uv/) and an internet
connection):

```bash
npm run voiceover                                   # default male voice (WanLung)
npm run voiceover -- --voice zh-HK-HiuGaaiNeural    # or HiuMaanNeural; female voices
npm run voiceover -- --rate +15% --only 42          # tweak speed / redo one clip
```

Or replace any file with your own recording of the same name and rebuild.

### Releasing and in-app updates

Settings → **App updates** checks
`releases/latest/download/latest.json` on this repo and installs a newer
signed build. To ship an update: bump `version` in `package.json`,
`src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, then push a `v*` tag.
CI signs the installers with the `TAURI_SIGNING_PRIVATE_KEY` repo secret
(the contents of `~/.tauri/number-bomb.key`, no password) and publishes
`latest.json`. Keep a backup of that key: without it, installed copies can't
be updated.

Windows builds are produced by CI (`.github/workflows/release.yml`) on a
`v*` tag push — building a Windows installer on Linux/macOS requires a
Windows machine or CI runner, which is why local builds only target your
current OS.

## Tech stack

Tauri 2 · React 19 · TypeScript · Tailwind CSS 4 · Vite · Vitest

## License

[MIT](LICENSE)
