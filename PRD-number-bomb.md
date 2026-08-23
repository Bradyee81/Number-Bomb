# PRD — Number Bomb

**Module type:** Standalone party/stage game app, companion to (not a mode of) the Lucky Draw app
**Status:** MVP scoping complete, ready for build
**Platform:** Windows desktop (Tauri), same target as Lucky Draw
**Output method:** Green-screen (chroma key) composited via OBS/vMix/switcher — app does not do its own compositing

---

## 1. Concept

A live stage/party game. A bomb number is hidden inside a range. Players shout out numbers; an operator enters what was called. Each call narrows the range from whichever side the bomb is on. Whoever calls the exact bomb number "detonates" it and is out for that round. Operator starts a fresh round with a new hidden bomb number and full range.

Tension comes from the shrinking range and the reveal animation/voiceover on every call — nobody but the app knows where the bomb actually is until it's hit.

---

## 2. Game logic (confirmed)

- **Range:** fixed at **01–99** for MVP (not 0–100, to keep digit formatting consistent — see Display section)
- **Bomb number:** chosen randomly within the active range at the start of each round; never shown to operator or audience
- **Turn order:** none — players shout freely, operator enters whichever number was called, in whatever order they're called
- **On each call (N):**
  - If `N == bomb` → **explosion**: explosion video plays, round ends, that player is "out" for the round only (not eliminated from the game)
  - If `N < bomb` → new **lower bound** = N
  - If `N > bomb` → new **upper bound** = N
  - Either way (non-bomb), the display updates to show the new range
- **Out-of-range calls:** no app-side validation — if a shouted number falls outside the current valid range, the operator simply doesn't enter it. No error state needed for MVP.
- **Repeat calls within a round:** not applicable — once a number is called, the range has already moved past it, so it can't be called again (self-enforcing by the range logic, no separate lock-out list needed)
- **Round end:** manual — operator ends the round after an explosion (or whenever they choose) and starts a new one; a new bomb number is randomly selected and the range resets to 01–99
- **No player/roster tracking** — the app is stateless per round. No names, no scores, no elimination history across rounds.

---

## 3. Display (audience-facing output window)

- Always shows exactly **two numbers**: current lower bound (left) and current upper bound (right). No grid, no history of past calls, no visible list of locked-out numbers.
- **Digit format:** both numbers always shown as 2 digits, zero-padded (e.g., `01`, `05`, `42`, `99`) — avoids the inconsistent digit-width of allowing 0 or 100.
- **Digit rendering:** sprite-strip slot-machine style, same visual system as Lucky Draw — 4 strips total (tens + units for the low number, tens + units for the high number).
- **On each call:** the relevant side's strips animate/reveal to land on the new bound (spin-and-decelerate per digit, matching Lucky Draw's landing style). No sweep/count-through across intermediate values — landing animation only.
- **Voiceover:** plays the called number N aloud using pre-recorded audio clips (numbers 01–99, recorded/generated once and bundled as static assets — no live TTS, for reliability at events).
- **On bomb hit:** the normal digit-strip landing/reveal of the bomb number still plays as usual — the explosion is an **effect layered on top of** that reveal, not a replacement for it. If the explosion video file can't be found, the number reveal still happens normally regardless; the explosion effect layer is simply skipped (see fallback below for what shows instead).
- **Explosion video missing/unavailable fallback:** if the configured video file can't be found or played, no video overlay plays — instead, the background flashes red (flashing red/alarm-style effect) on top of the normal number reveal. The app never breaks or halts due to a missing file; the reveal always completes.
- **Idle/round-start state:** displays 01 and 99 (full range) until the first number is called. *(Flag: confirm this is the desired idle state before build, or if a distinct "waiting" screen is wanted.)*

---

## 4. Chroma key / display styling

- Same configurable chroma key color preset system as Lucky Draw (6–8 curated presets), reused directly — no need to rebuild, just port the settings panel/component.
- No custom canvas compositing — output is a clean, fixed-key-color background composited externally via OBS/vMix.

---

## 5. Explosion video

- **Explosion video:** operator-swappable **MP4** clip, played as an overlay effect **on top of** the normal number-reveal animation (not a replacement for it) when the called number is the bomb. The reveal always happens; the explosion is additive.
- MP4s must have a **solid background matching the current chroma key color** (not true alpha transparency — standard MP4/H.264 doesn't support an alpha channel). The whole app output, including the video, gets keyed out together in OBS/vMix, consistent with how the rest of the display already works.
- Operator can select/upload/swap the explosion clip via the control panel (file picker to a local video file). Multiple saved clips could be supported as a fast-follow, but MVP just needs "point to a video file, play it as an overlay on bomb hit."

---

## 6. Operator side (control panel)

- **Second-screen setup**, same dual-window pattern as Lucky Draw: operator control panel on the primary monitor, clean output window on the second screen/output source.
- **Number entry:** operator types the number a player shouted, presses **Enter** to submit.
- **Undo (single-level):** operator can undo the most recent call, rolling the game state back to exactly how it was before that call — restoring the previous lower/upper bound, or reversing an explosion (round continues instead of having ended) if the mis-entered call was the bomb. Only one step of undo is available — the call before the most recent one can't be recovered once another call is made. After undo, the operator re-enters the correct number normally.
- **No range validation UI needed** — operator is trusted to only enter in-range numbers; out-of-range entries are a non-issue for MVP (see Section 2).
- **Round controls:** Start Round (picks new bomb, resets range to 01–99), End Round (manual, e.g. after an explosion or operator's call).
- **No player roster/name entry UI** — nothing to manage per player.
- **Settings panel:** chroma key color preset picker, explosion video file picker — mirrors Lucky Draw's settings structure where possible.

---

## 7. Architecture notes

- **Repository:** `Bradyee81/Number-Bomb` on GitHub (private repo).

- **Standalone Tauri app**, separate codebase from Lucky Draw — the two games share no participant/data model, so bundling them into one app or one "mode switcher" isn't warranted. Reuse Lucky Draw's project scaffold, digit-strip component, chroma key settings component, and dual-window pattern as a starting point rather than building those from zero.
- **No backend/Supabase dependency** — this game is fully local/stateless across rounds, no need to touch the shared backend. Within a round, the app keeps a single-step state snapshot (previous range + explosion status) in memory to support one-level undo — this doesn't need persistent storage, just in-memory app state.
- **No ESP32/hardware integration** for MVP — confirmed out of scope, unlike Lucky Draw's buzzer integration.
- **Audio assets:** pre-recorded voiceover clips for numbers 01–99, bundled with the app (static files, e.g. `/audio/01.mp3` … `/audio/99.mp3`).

---

## 8. Out of scope for MVP (fast-follow candidates)

- Player name/roster tracking, scores, or cross-round elimination history
- Multiple selectable explosion clips with a picker UI (MVP = one active clip, swappable via file picker)
- In-app alpha-channel video transparency (WebM) — MVP uses chroma-matched MP4 background instead
- Out-of-range input validation/error states
- Configurable range (beyond fixed 01–99) or configurable digit-strip count
- ESP32 buzzer / hardware integration
- Sound effects beyond number voiceover + explosion clip's own audio (e.g. ambient tension sound, ticking) — not yet discussed, flag if wanted

---

## 9a. Packaging & visual design timeline

- **Distribution format:** final build output as a Windows installable **.exe** (Tauri's native installer bundling), not just a dev build — same as Lucky Draw's distribution approach.
- **Visual design pass:** MVP is built functionally first with placeholder/matching-style visuals; a dedicated Figma redesign pass happens **after** the app is built and working, layering polished visuals on top of the working MVP rather than blocking the build on design work.
- **Project name:** Number Bomb
- **App icon:** bomb icon, source PNG created at 512×512 — Tauri can auto-generate the full icon set (`.ico` for Windows, etc.) from this single square source image via `tauri icon`.
- **Output resolution:** 1920×1080, matching Lucky Draw's display window sizing for consistent OBS/vMix source setup
- **Settings persistence:** chroma key color choice and explosion video path saved to a local config file, persisting across app launches (not reset each time)
- **Explosion video storage:** default explosion.mp4 ships bundled with the app; operator can "Browse" in settings to point to a custom MP4, whose file path is saved to local config. Recommended location for user-supplied clips: a plain folder outside the install directory (e.g. `%APPDATA%/NumberBomb/media/`), so custom videos survive app updates/reinstalls.
- **Voiceover volume:** adjustable via a control in settings/operator panel (not fixed).

## 9. Confirmed decisions (closing out Section 9 opens)

- **Idle/round-start state:** confirmed — displays 01/99 by default until the first call.
- **Explosion sound:** comes from the MP4 file itself; app doesn't layer separate audio on top.
- **Digit-strip component:** built as a separate implementation matching Lucky Draw's visual style (deceleration, reveal behavior) — not a literal shared/imported component. Keeps this app fully independent, at the cost of maintaining two similar-but-separate implementations for now.
- **Build/integration strategy:** Number Bomb is built as a fully independent standalone app first (own repo/project, own build), matching Lucky Draw's visual language but not sharing code. Cross-module integration (a unified games dashboard to launch/manage all the party games together) is deferred to the Dashboard module, planned later once more modules exist. This keeps each app simple to build and maintain individually now, with consolidation happening once there's more than one or two games to justify it.
