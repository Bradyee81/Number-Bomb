import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { CHROMA_PRESETS, type Settings } from "../../types";
import { useSettings } from "../SettingsContext";

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [busy, setBusy] = useState(false);

  if (!settings) return null;

  const set = (patch: Partial<Settings>) => {
    void updateSettings(patch);
  };

  const pickVideo = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    setBusy(true);
    try {
      await mkdir("media", { baseDir: BaseDirectory.AppData, recursive: true });
      const fileName = selected.split(/[\\/]/).pop() ?? "explosion.mp4";
      const destRelative = `media/${fileName}`;
      await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });
      const absolutePath = await join(await appDataDir(), destRelative);
      await updateSettings({ explosion_video_path: absolutePath });
    } finally {
      setBusy(false);
    }
  };

  const pickCenterVideo = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    setBusy(true);
    try {
      await mkdir("media", { baseDir: BaseDirectory.AppData, recursive: true });
      const fileName = selected.split(/[\\/]/).pop() ?? "center-video.mp4";
      const destRelative = `media/${fileName}`;
      await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });
      const absolutePath = await join(await appDataDir(), destRelative);
      await updateSettings({ center_video_path: absolutePath });
    } finally {
      setBusy(false);
    }
  };

  const pickCenterIcon = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "svg"] }],
    });
    if (!selected || Array.isArray(selected)) return;
    setBusy(true);
    try {
      await mkdir("media", { baseDir: BaseDirectory.AppData, recursive: true });
      const fileName = selected.split(/[\\/]/).pop() ?? "center-icon.png";
      const destRelative = `media/${fileName}`;
      await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });
      const absolutePath = await join(await appDataDir(), destRelative);
      await updateSettings({ center_icon_path: absolutePath });
    } finally {
      setBusy(false);
    }
  };

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
              className={`flex flex-col items-center gap-1.5 rounded-md border p-2 ${
                settings.chroma_color === preset.hex
                  ? "border-[#F5C518] ring-1 ring-[#F5C518]"
                  : "border-white/10 hover:border-white/25"
              }`}
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
        <label className="mb-2 block font-semibold">Explosion video</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.explosion_video_path || "Using bundled default"}
        </p>
        <button
          onClick={pickVideo}
          disabled={busy}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40"
        >
          {busy ? "Copying…" : "Browse…"}
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Center loop video</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.center_video_path || "None set — fallback icon shown instead"}
        </p>
        <button
          onClick={pickCenterVideo}
          disabled={busy}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40"
        >
          {busy ? "Copying…" : "Browse…"}
        </button>
      </section>

      <section className="mb-8">
        <label className="mb-2 block font-semibold">Center fallback icon</label>
        <p className="mb-2 text-xs text-white/40">
          {settings.center_icon_path || "Using bundled default"}
        </p>
        <button
          onClick={pickCenterIcon}
          disabled={busy}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40"
        >
          {busy ? "Copying…" : "Browse…"}
        </button>
      </section>

      <section>
        <label className="mb-2 block font-semibold">Voiceover volume</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.voiceover_volume}
          onChange={(e) => set({ voiceover_volume: Number(e.target.value) })}
          className="w-64"
        />
      </section>
    </div>
  );
}
