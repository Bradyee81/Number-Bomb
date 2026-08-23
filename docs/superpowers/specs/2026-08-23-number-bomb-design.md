# Design — Number Bomb

**Status:** Approved, ready for implementation planning
**Source requirements:** `PRD-number-bomb.md` (repo root) — this document is the technical design that satisfies it; consult the PRD for full product rationale, this doc focuses on architecture and implementation decisions.
**Reference implementation:** `Bradyee81/eventdraw` (Lucky Draw) — cloned for inspection at design time; scaffold, `SlotReel`, dual-window pattern, and chroma presets are ported from it.

---

## 1. Stack & project scaffold

Mirrors Lucky Draw exactly:

- Vite + React 19 + TypeScript + Tailwind 4
- Tauri 2, `identifier: com.brad.numberbomb`, `productName: "Number Bomb"`
- Two windows, split by label in `main.tsx`:
  - `control` (1280×800, operator UI, primary monitor)
  - `output` (1920×1080 per PRD §9a — Lucky Draw uses 1280×720, Number Bomb overrides this to match target OBS/vMix source sizing)
- Cross-window communication via Tauri's `emit`/`listen` event bus, wrapped in a typed `src/lib/events.ts` (same pattern as Lucky Draw's `LuckyDrawEvents` map)
- Window present/exit-fullscreen toggle: port `presentWindow.ts` as-is (window-existence + fullscreen toggle logic is generic, not Lucky-Draw-specific)

**Rust toolchain is not installed on this machine.** Installed via `rustup` (user-level `~/.cargo`, no sudo) as the first implementation step.

**Repo:** `Bradyee81/Number-Bomb` on GitHub already exists (private, empty). This folder becomes its working tree; first push happens after the operator confirms the initial commit looks right.

---

## 2. Config persistence — deviation from Lucky Draw

Lucky Draw persists its config in a SQLite table (`tauri-plugin-sql` + migrations) because it also stores participants, draw history, and prizes — genuine relational data.

Number Bomb has exactly two persisted settings: `chroma_color` and `explosion_video_path` (plus, per PRD §9a, voiceover volume). There's no relational data and no history to track (PRD §2: "the app is stateless per round"). Pulling in SQLite + migrations for two string fields is unwarranted.

**Decision:** persist settings as a single JSON file via `tauri-plugin-fs`, written to the Tauri app config dir (e.g. `%APPDATA%/NumberBomb/config.json` on Windows). No `tauri-plugin-sql` dependency at all.

```ts
interface NumberBombSettings {
  chroma_color: string;       // hex, one of CHROMA_PRESETS
  explosion_video_path: string; // absolute path, or "" for bundled default
  voiceover_volume: number;   // 0.0–1.0
}
```

Loaded once on control-window startup; every settings-screen change writes the whole file back (small file, no need for granular writes) and `emit`s `config:updated` so the output window picks up the new chroma color live.

---

## 3. Game state (control window, in-memory only)

Per PRD §2/§7, round state lives entirely in memory — no persistence across app restarts, no history.

```ts
type RoundStatus = "idle" | "active" | "exploded" | "ended";

interface RoundState {
  bomb: number;         // 1–99, never sent to output or exposed in control UI
  low: number;           // current lower bound, starts at 1
  high: number;          // current upper bound, starts at 99
  status: RoundStatus;
  lastCall: number | null; // most recent N entered, for the undo snapshot
}

interface UndoSnapshot {
  round: RoundState;
}
```

- **Start Round**: picks `bomb = randomInt(1, 99)`, resets `low=1, high=99, status="active"`, clears undo snapshot, `emit`s `bomb:round-start` with the new `{low, high}` (never the bomb). Usable at any time — including mid-round, or right after an explosion without pressing End Round first — since it always resets fully regardless of prior state.
- **Call submitted (N)**: snapshot current `RoundState` into `UndoSnapshot` (single slot, overwrites any prior snapshot). Compare `N` to `bomb`:
  - `N === bomb` → `status = "exploded"`, `emit("bomb:call", { n: N, low, high, exploded: true })`
  - `N < bomb` → `low = N`, `emit("bomb:call", { n: N, low, high, exploded: false })`
  - `N > bomb` → `high = N`, `emit("bomb:call", { n: N, low, high, exploded: false })`
  - No range validation — operator is trusted (PRD §2/§6).
- **Undo**: if a snapshot exists, restore `RoundState` from it, clear the snapshot (single-level — can't undo twice), `emit("bomb:undo", { low, high, exploded: status === "exploded" })` so the output window re-lands the previous bounds and clears any explosion overlay if the undone call was the bomb hit.
- **End Round**: a distinct manual action, separate from Start Round — closes out the current round without immediately queuing a new bomb. Sets `status = "ended"`, clears the undo snapshot (nothing left to undo into), `emit`s `bomb:round-end` so the output window returns to the idle 01/99 display and number entry is disabled on the control side until the operator presses Start Round. This is the PRD §6 flow: explosion → operator manually ends the round (display resets to idle) → operator starts the next one when ready. Start Round remains available at any time regardless of whether End Round was pressed first.

This state lives in a React context/hook in the control window (`useRoundState`), analogous to Lucky Draw's `AppDataContext` but without any DB-backed `loading` state — it's synchronous in-memory init.

---

## 4. Output window rendering

- **4 `SlotReel`s**: low-tens, low-units, high-tens, high-units. `SlotReel.tsx` ports from Lucky Draw essentially unchanged (sprite-strip background-position-y animation, cubic-bezier landing, `transitionend` + timeout-fallback completion) — this component is generic digit-strip rendering, not Lucky-Draw-specific despite PRD §9's note about keeping implementations separate (separate *file*, ported *logic*).
- **Idle state**: on mount / after `bomb:round-start`, all 4 reels land on `01` / `99` (PRD §3, §9 — confirmed default).
- **On `bomb:call`**: the two reels for whichever side moved (low pair or high pair) animate to the new digits via the existing landing sequence; the other pair stays locked. No sweep through intermediate values.
- **On explosion** (`bomb:call` with `exploded: true`): the normal reel landing for the bomb's own digits still plays (the side that "moved" to exactly the bomb value). Layered on top:
  - Video overlay: `<video>` element sourced from the current `explosion_video_path` setting (or bundled `explosion.mp4` default), plays once, full-screen overlay, removed after `ended` event.
  - If the video fails to load (`onerror`, or `tauri-plugin-fs` `exists()` check comes back false before attempting playback) → skip the video, instead flash the background red a few times via CSS animation. The reveal itself is never blocked by this branch (PRD §3).
- **Voiceover**: on every call (including the bomb hit), play `/audio/{N.toString().padStart(2,'0')}.mp3` at `voiceover_volume`. **Audio clips themselves are not sourced in this pass** — the lookup-and-play plumbing is built now (missing-file play errors are caught and ignored, same non-blocking posture as the video fallback), actual `01.mp3`…`99.mp3` content is a fast-follow the operator will drop into `src/assets/audio/` or bundle later.
- **Chroma background**: `backgroundColor: config.chroma_color`, identical to Lucky Draw's `OutputApp`.

---

## 5. Control window screens

Simpler nav than Lucky Draw (no Setup/roster, no Auto Draw, no Results):

| Screen | Purpose |
|---|---|
| **Play** | Number entry field (Enter to submit), Undo button (disabled when no snapshot), Start Round / End Round buttons, current low/high shown for operator reference (not the bomb) |
| **Settings** | Chroma preset grid (ported from Lucky Draw `DisplayScreen`, presets list reused verbatim from `CHROMA_PRESETS`), explosion video file picker (`tauri-plugin-dialog` → copies chosen file into `%APPDATA%/NumberBomb/media/`, per PRD §9a, saves the path into settings), voiceover volume slider |

No participant/roster screens, no results/history screens, no Auto Draw equivalent — all correctly out of scope per PRD §8.

---

## 6. Packaging

- App icon: `Number Bomb.png` (512×512, already in repo root) run through `tauri icon` to generate the full Windows icon set — same flow as Lucky Draw's `src-tauri/icons/`.
- Default explosion clip: `Explosion.mp4` (already in repo root) copied into `src-tauri/` bundled resources (or `public/`) as the shipped default, distinct from any operator-supplied custom clip in `%APPDATA%/NumberBomb/media/`.
- Distribution: Tauri's native Windows installer build (`tauri build`), matching Lucky Draw's approach (PRD §9a).

---

## 7. Explicitly out of scope for this build (per PRD §8, unchanged)

Player rosters/scores, multi-clip explosion picker, WebM alpha video, out-of-range validation, configurable range/digit count, ESP32 integration, extra sound effects beyond voiceover + the clip's own audio. Also out of scope for *this pass* specifically: sourcing the 99 voiceover audio files (plumbing only) and the post-MVP Figma visual redesign pass (PRD §9a).

---

## 8. Testing approach

- Game-logic unit tests for the round-state reducer (`Start Round` → bomb selection stays hidden, call narrows correct bound, explosion detection, single-level undo restores exact prior state including reversing an explosion).
- Manual verification in the running app (per project convention) for: digit-strip landing animation, chroma key rendering, explosion video overlay + red-flash fallback, dual-window present/exit-fullscreen behavior, settings persistence across app restart.
