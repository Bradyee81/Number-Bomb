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
  source. Pick which screen it presents on from the sidebar; **Present** goes
  fullscreen there and **Exit Present** closes it.
- **Slot-machine style reels** for the current low/high bounds, with a
  landing animation on every call.
- **Explosion overlay** on a bomb hit — a swappable video clip layered over
  the reveal, with a red-flash fallback. Can be switched off so the bomb
  number just appears.
- **Center display** — a looping video (or a fallback icon) that turns into
  the actual bomb number when it's revealed.
- **Range voiceover** after every call (e.g. "十二 至 九十九") in Cantonese,
  Mandarin or English, with adjustable speed and volume. A bomb hit reads the
  number plus a hit line (哈哈哈，你开口中), each switchable or replaceable with
  your own recording.
- **Sound effects:** a chime before each safe-call announcement and a boom on
  a bomb hit — each switchable, with built-in defaults or your own upload.
- **Configurable chroma key color** or a background image/video, explosion
  clip, center video/icon, reel digit-strip image, bomb-reveal font and size,
  and overall Output size — all from the Settings screen, no rebuild required.
- **Single-level undo** for mis-entered calls, including reversing an
  explosion.
- Out-of-range call validation. **Reveal Bomb** shows the bomb to the
  operator only; **Show on Output** (after a confirmation) shows it to the
  audience.
- **Check for updates** and an admin-password **Factory reset** in Settings.

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

### Balloon popper

Settings includes an ESP32 firmware updater, USB WiFi pairing and relay-only
test. Play has a per-round Arm/Disarm control; only a losing number can send
one automatic trigger. Setup, wiring and acceptance checks are in
[the popper guide](docs/popper-setup.md). Keep heater power disconnected while
flashing and testing the game connection. The event laptop needs the updated
installer, not the older installed app.

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

The voice packs in `public/audio/<lang>/` (`yue` Cantonese, `cmn` Mandarin,
`en` English — `01.mp3`…`99.mp3`, `to.mp3` and `hit.mp3`) are generated with
Microsoft neural TTS via [edge-tts](https://github.com/rany2/edge-tts) and
silence-trimmed with ffmpeg. To regenerate them (needs
[uv](https://docs.astral.sh/uv/) and an internet connection):

```bash
npm run voiceover                                       # all three packs
npm run voiceover -- --lang yue --voice zh-HK-HiuGaaiNeural   # change one pack's voice
npm run voiceover -- --lang en --only 42                # redo one clip
npm run sfx                                             # regenerate default chime/boom
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
