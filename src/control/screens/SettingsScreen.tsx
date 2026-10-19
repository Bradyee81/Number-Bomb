import { useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import {
  CHROMA_PRESETS,
  CUSTOM_FONT_FAMILY_NAME,
  FONT_PRESETS,
  VOICE_LANGUAGES,
  type Settings,
} from "../../types";
import { emitEvent } from "../../lib/events";
import { previewHit, previewSfx, previewVoice } from "../../lib/audio";
import { useSettings } from "../SettingsContext";
import { UpdateSection } from "../UpdateSection";
import { FactoryResetSection } from "../FactoryResetSection";

const PRIMARY_BTN =
  "rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40";
const SECONDARY_BTN =
  "rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40";

function optionClass(selected: boolean): string {
  return selected
    ? "border-[#F5C518] ring-1 ring-[#F5C518]"
    : "border-white/10 hover:border-white/25";
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#F5C518]"
      />
      {children}
    </label>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs uppercase text-white/40">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-64"
      />
    </div>
  );
}

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [busy, setBusy] = useState(false);

  if (!settings) return null;

  const set = (patch: Partial<Settings>) => {
    void updateSettings(patch);
  };

  /** Copies a picked file into %APPDATA%/media (so it survives updates) and returns its path. */
  const pickMedia = async (
    filter: { name: string; extensions: string[] },
    fallbackName: string,
    apply: (absolutePath: string) => Partial<Settings>,
  ) => {
    const selected = await open({ multiple: false, filters: [filter] });
    if (!selected || Array.isArray(selected)) return;
    setBusy(true);
    try {
      await mkdir("media", { baseDir: BaseDirectory.AppData, recursive: true });
      const fileName = selected.split(/[\\/]/).pop() ?? fallbackName;
      const destRelative = `media/${fileName}`;
      await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });
      const absolutePath = await join(await appDataDir(), destRelative);
      await updateSettings(apply(absolutePath));
    } finally {
      setBusy(false);
    }
  };

  const VIDEO = { name: "Video", extensions: ["mp4"] };
  const BACKGROUND = { name: "Image or video", extensions: ["png", "jpg", "jpeg", "webp", "mp4", "webm"] };
  const IMAGE = { name: "Image", extensions: ["png", "jpg", "jpeg", "svg"] };
  const FONT = { name: "Font", extensions: ["ttf", "otf", "woff", "woff2"] };
  const AUDIO = { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a"] };

  const browseLabel = busy ? "Copying…" : "Browse…";

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-1 text-xl font-bold">Settings</h1>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Chroma key background</label>
        <div className="grid grid-cols-4 gap-3">
          {CHROMA_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              onClick={() => set({ chroma_color: preset.hex })}
              className={`flex flex-col items-center gap-1.5 rounded-md border p-2 ${optionClass(
                settings.chroma_color === preset.hex,
              )}`}
            >
              <div className="h-10 w-full rounded" style={{ backgroundColor: preset.hex }} />
              <span className="text-[11px] text-white/60">{preset.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/40">
          Pick a preset that doesn't visually clash with the digit strip so the switcher can key
          it out cleanly.
        </p>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Background image or video</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.background_path || "None — plain chroma key color shown"}. Fills the whole
          Output screen (cropped to fit): use 16:9, 1920×1080 (PNG/JPG, or a looping MP4 — video
          plays muted). Leave empty if you key out the background in OBS/vMix.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() =>
              pickMedia(BACKGROUND, "background.png", (p) => ({ background_path: p }))
            }
            disabled={busy}
            className={PRIMARY_BTN}
          >
            {browseLabel}
          </button>
          {settings.background_path && (
            <button onClick={() => set({ background_path: "" })} className={SECONDARY_BTN}>
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Output size</label>
        <p className="mb-2 text-xs text-white/40">
          Scales the reels and center display on the Output screen. Layout is designed for
          1920×1080 and scales to any screen resolution automatically.
        </p>
        <Slider
          label={`Size (${Math.round(settings.output_scale * 100)}%)`}
          min={0.5}
          max={1.4}
          step={0.05}
          value={settings.output_scale}
          onChange={(v) => set({ output_scale: v })}
        />
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Explosion video</label>
        <Toggle
          checked={settings.explosion_enabled}
          onChange={(v) => set({ explosion_enabled: v })}
        >
          Play explosion on bomb hit (off: no video, the bomb number just appears)
        </Toggle>
        <p className="mb-2 text-xs text-white/40">
          {settings.explosion_video_path || "Using bundled default"}. Fills the whole screen —
          use a 16:9 MP4, ideally 1920×1080.
        </p>
        <button
          onClick={() =>
            pickMedia(VIDEO, "explosion.mp4", (p) => ({ explosion_video_path: p }))
          }
          disabled={busy || !settings.explosion_enabled}
          className={PRIMARY_BTN}
        >
          {browseLabel}
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Center loop video</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.center_video_path || "None set — fallback icon shown instead"}. Shown as a
          square (520×520 at 100% size) — use a 1:1 MP4, at least 520×520 (1080×1080 ideal).
        </p>
        <div className="flex gap-2">
          <button
            onClick={() =>
              pickMedia(VIDEO, "center-video.mp4", (p) => ({ center_video_path: p }))
            }
            disabled={busy}
            className={PRIMARY_BTN}
          >
            {browseLabel}
          </button>
          {settings.center_video_path && (
            <button onClick={() => set({ center_video_path: "" })} className={SECONDARY_BTN}>
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Center fallback icon</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.center_icon_path || "Using bundled default"}. Square image, at least 520×520
          (transparent PNG works best).
        </p>
        <button
          onClick={() => pickMedia(IMAGE, "center-icon.png", (p) => ({ center_icon_path: p }))}
          disabled={busy}
          className={PRIMARY_BTN}
        >
          {browseLabel}
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Reel digit strip image</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.digit_strip_path || "Using bundled default"}. Must be a vertical strip of 10
          digits (0 at top, 9 at bottom), each cell 200×300px — matching the default asset's
          layout, or the reel spin animation will look misaligned.
        </p>
        <button
          onClick={() =>
            pickMedia(IMAGE, "digit-strip.png", (p) => ({ digit_strip_path: p }))
          }
          disabled={busy}
          className={PRIMARY_BTN}
        >
          {browseLabel}
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Bomb number font</label>
        <p className="mb-3 text-xs text-white/40">
          Used for the bomb number shown in the center after a hit or Reveal Bomb. (The reel
          digits come from the digit strip image above.)
        </p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {FONT_PRESETS.map((preset) => (
            <button
              key={preset.family}
              onClick={() => set({ bomb_font_family: preset.family })}
              style={{ fontFamily: preset.family }}
              className={`rounded-md border px-3 py-2 text-lg ${optionClass(
                settings.bomb_font_family === preset.family,
              )}`}
              title={preset.name}
            >
              88
            </button>
          ))}
          {settings.custom_font_path && (
            <button
              onClick={() => set({ bomb_font_family: CUSTOM_FONT_FAMILY_NAME })}
              className={`rounded-md border px-3 py-2 text-lg ${optionClass(
                settings.bomb_font_family === CUSTOM_FONT_FAMILY_NAME,
              )}`}
              title="Your uploaded font"
            >
              My Font
            </button>
          )}
        </div>
        <button
          onClick={() =>
            pickMedia(FONT, "custom-font.ttf", (p) => ({
              custom_font_path: p,
              bomb_font_family: CUSTOM_FONT_FAMILY_NAME,
            }))
          }
          disabled={busy}
          className={`mb-4 ${SECONDARY_BTN}`}
        >
          {busy
            ? "Copying…"
            : settings.custom_font_path
              ? "Replace uploaded font…"
              : "Upload your own font…"}
        </button>
        <Slider
          label={`Font size (${settings.bomb_font_size_px}px at 100% output size)`}
          min={40}
          max={1000}
          step={10}
          value={settings.bomb_font_size_px}
          onChange={(v) => set({ bomb_font_size_px: v })}
        />
        <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30">
          <span
            className="font-bold leading-none text-[#F5C518]"
            style={{
              fontFamily: settings.bomb_font_family,
              // Preview at 15% so the full range fits; the label shows the real size.
              fontSize: settings.bomb_font_size_px * 0.15,
            }}
          >
            88
          </span>
        </div>
        <button
          onClick={() => void emitEvent("display:preview-font", {})}
          className={SECONDARY_BTN}
        >
          Preview on Output (3 s)
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Voiceover</label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {VOICE_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => set({ voice_language: lang.id })}
              className={`rounded-md border px-3 py-2 text-sm ${optionClass(
                settings.voice_language === lang.id,
              )}`}
            >
              {lang.name}
            </button>
          ))}
        </div>
        <Slider
          label={`Speed (${settings.voice_speed.toFixed(2)}×)`}
          min={0.6}
          max={1.3}
          step={0.05}
          value={settings.voice_speed}
          onChange={(v) => set({ voice_speed: v })}
        />
        <Slider
          label={`Volume (${Math.round(settings.voiceover_volume * 100)}%)`}
          min={0}
          max={1}
          step={0.05}
          value={settings.voiceover_volume}
          onChange={(v) => set({ voiceover_volume: v })}
        />
        <button onClick={() => previewVoice(settings)} className={SECONDARY_BTN}>
          ▶ Play sample
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Bomb hit announcement</label>
        <Toggle
          checked={settings.hit_number_enabled}
          onChange={(v) => set({ hit_number_enabled: v })}
        >
          Read out the bomb number
        </Toggle>
        <Toggle
          checked={settings.hit_line_enabled}
          onChange={(v) => set({ hit_line_enabled: v })}
        >
          Then play the hit line
        </Toggle>
        <p className="mb-2 text-xs text-white/40">
          {settings.hit_line_path ||
            "Using the built-in line for the selected language (Cantonese: 哈哈哈，你开口中)"}
        </p>
        <div className="flex gap-2">
          <button onClick={() => previewHit(settings)} className={SECONDARY_BTN}>
            ▶ Play
          </button>
          <button
            onClick={() => pickMedia(AUDIO, "hit-line.mp3", (p) => ({ hit_line_path: p }))}
            disabled={busy || !settings.hit_line_enabled}
            className={SECONDARY_BTN}
          >
            {busy ? "Copying…" : "Upload your own…"}
          </button>
          {settings.hit_line_path && (
            <button onClick={() => set({ hit_line_path: "" })} className={SECONDARY_BTN}>
              Use default
            </button>
          )}
        </div>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Sound effects</label>
        <Slider
          label={`Effects volume (${Math.round(settings.sfx_volume * 100)}%)`}
          min={0}
          max={1}
          step={0.05}
          value={settings.sfx_volume}
          onChange={(v) => set({ sfx_volume: v })}
        />

        <div className="mb-4 rounded-md border border-white/10 p-3">
          <Toggle
            checked={settings.call_sfx_enabled}
            onChange={(v) => set({ call_sfx_enabled: v })}
          >
            Safe-call sound before each number announcement
          </Toggle>
          <p className="mb-2 text-xs text-white/40">
            {settings.call_sfx_path || "Using bundled chime"}
          </p>
          <SfxButtons
            busy={busy}
            custom={!!settings.call_sfx_path}
            onPreview={() => previewSfx("call", settings)}
            onBrowse={() => pickMedia(AUDIO, "call-sound.mp3", (p) => ({ call_sfx_path: p }))}
            onReset={() => set({ call_sfx_path: "" })}
          />
        </div>

        <div className="rounded-md border border-white/10 p-3">
          <Toggle
            checked={settings.hit_sfx_enabled}
            onChange={(v) => set({ hit_sfx_enabled: v })}
          >
            Bomb sound on hit (plays over the explosion video's own audio)
          </Toggle>
          <p className="mb-2 text-xs text-white/40">
            {settings.hit_sfx_path || "Using bundled boom"}
          </p>
          <SfxButtons
            busy={busy}
            custom={!!settings.hit_sfx_path}
            onPreview={() => previewSfx("hit", settings)}
            onBrowse={() => pickMedia(AUDIO, "hit-sound.mp3", (p) => ({ hit_sfx_path: p }))}
            onReset={() => set({ hit_sfx_path: "" })}
          />
        </div>
      </section>

      <UpdateSection />
      <FactoryResetSection />
    </div>
  );
}

function SfxButtons({
  busy,
  custom,
  onPreview,
  onBrowse,
  onReset,
}: {
  busy: boolean;
  custom: boolean;
  onPreview: () => void;
  onBrowse: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button onClick={onPreview} className={SECONDARY_BTN}>
        ▶ Play
      </button>
      <button onClick={onBrowse} disabled={busy} className={SECONDARY_BTN}>
        {busy ? "Copying…" : "Upload your own…"}
      </button>
      {custom && (
        <button onClick={onReset} className={SECONDARY_BTN}>
          Use default
        </button>
      )}
    </div>
  );
}
