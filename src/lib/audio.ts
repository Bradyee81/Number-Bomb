import { convertFileSrc } from "@tauri-apps/api/core";
import { DEFAULT_CALL_SFX, DEFAULT_HIT_SFX, type Settings } from "../types";

// Voice packs live in /audio/<lang>/: 01.mp3…99.mp3, to.mp3 ("至" / "to") and
// hit.mp3 (e.g. "哈哈哈，你开口中"). The clips are pre-trimmed of silence by
// scripts/generate-voiceover.mjs, so announcements are just played back-to-back.
// HTMLAudioElement is used (not Web Audio) so speed changes keep the pitch.

interface Step {
  src: string;
  volume: number;
  rate: number;
  /** Start the next step after this many seconds even if this one is still playing. */
  overlapAfterSec?: number;
}

let playToken = 0;
let playing: HTMLAudioElement[] = [];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function voiceClip(settings: Settings, name: string): Step {
  return {
    src: `/audio/${settings.voice_language}/${name}.mp3`,
    volume: clamp01(settings.voiceover_volume),
    rate: settings.voice_speed,
  };
}

function numberClip(settings: Settings, n: number): Step {
  return voiceClip(settings, String(n).padStart(2, "0"));
}

function sfxSrc(customPath: string, fallback: string): string {
  return customPath ? convertFileSrc(customPath) : fallback;
}

function stopAll(): void {
  playing.forEach((a) => a.pause());
  playing = [];
}

function playSequence(steps: Step[]): void {
  const token = ++playToken;
  stopAll();

  // Create (and start loading) every clip up front so there's no fetch gap between them.
  const els = steps.map((step) => {
    const a = new Audio(step.src);
    a.preload = "auto";
    a.volume = step.volume;
    a.playbackRate = step.rate;
    a.preservesPitch = true;
    return a;
  });
  playing = els;

  const playAt = (i: number) => {
    if (token !== playToken || i >= els.length) return;
    const el = els[i];
    let advanced = false;
    const next = () => {
      if (advanced) return;
      advanced = true;
      playAt(i + 1);
    };
    el.addEventListener("ended", next, { once: true });
    el.addEventListener("error", next, { once: true });
    const overlap = steps[i].overlapAfterSec;
    if (overlap !== undefined) setTimeout(next, overlap * 1000);
    el.play().catch(next); // missing clip or autoplay blocked — skip, never block the game
  };
  playAt(0);
}

/** After a safe call: optional chime, then the new range, e.g. "十二 至 九十九". */
export function playCallAnnouncement(low: number, high: number, settings: Settings): void {
  const steps: Step[] = [];
  if (settings.call_sfx_enabled) {
    steps.push({
      src: sfxSrc(settings.call_sfx_path, DEFAULT_CALL_SFX),
      volume: clamp01(settings.sfx_volume),
      rate: 1,
      overlapAfterSec: 0.35,
    });
  }
  steps.push(numberClip(settings, low), voiceClip(settings, "to"), numberClip(settings, high));
  playSequence(steps);
}

/** On a bomb hit: optional bomb sound, then the bomb number and the hit line. */
export function playBombHit(n: number, settings: Settings): void {
  const steps: Step[] = [];
  if (settings.hit_sfx_enabled) {
    steps.push({
      src: sfxSrc(settings.hit_sfx_path, DEFAULT_HIT_SFX),
      volume: clamp01(settings.sfx_volume),
      rate: 1,
      overlapAfterSec: 0.8,
    });
  }
  if (settings.hit_number_enabled) steps.push(numberClip(settings, n));
  if (settings.hit_line_enabled) {
    steps.push(
      settings.hit_line_path
        ? { src: convertFileSrc(settings.hit_line_path), volume: clamp01(settings.voiceover_volume), rate: 1 }
        : voiceClip(settings, "hit"),
    );
  }
  playSequence(steps);
}

/** Settings-screen preview of a sound effect. */
export function previewSfx(kind: "hit" | "call", settings: Settings): void {
  const src =
    kind === "hit"
      ? sfxSrc(settings.hit_sfx_path, DEFAULT_HIT_SFX)
      : sfxSrc(settings.call_sfx_path, DEFAULT_CALL_SFX);
  playSequence([{ src, volume: clamp01(settings.sfx_volume), rate: 1 }]);
}

/** Settings-screen preview of the bomb-hit announcement. */
export function previewHit(settings: Settings): void {
  playBombHit(42, settings);
}

/** Settings-screen preview of the voice, e.g. "十二 至 九十九". */
export function previewVoice(settings: Settings): void {
  playSequence([numberClip(settings, 12), voiceClip(settings, "to"), numberClip(settings, 99)]);
}
