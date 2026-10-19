import { useState, type FormEvent } from "react";
import { exists, remove, BaseDirectory } from "@tauri-apps/plugin-fs";
import { DEFAULT_SETTINGS } from "../types";
import { useSettings } from "./SettingsContext";

// Keeps casual users from wiping a show's setup by accident; it is not real security.
const ADMIN_PASSWORD = "admin";

export function FactoryResetSection() {
  const { updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      setError("Wrong admin password");
      return;
    }
    setBusy(true);
    try {
      // Reset settings first so the Output window lets go of any uploaded video
      // or image (Windows won't delete a file that's still open).
      await updateSettings(DEFAULT_SETTINGS);
      await new Promise((r) => setTimeout(r, 500));
      // Uploaded videos, images, fonts and sounds are copies in %APPDATA%/media.
      if (await exists("media", { baseDir: BaseDirectory.AppData })) {
        await remove("media", { baseDir: BaseDirectory.AppData, recursive: true });
      }
      close();
      setDone(true);
    } catch (err) {
      setError(`Settings were reset, but some uploaded files couldn't be deleted: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-md border border-red-500/40 p-4">
      <label className="mb-2 block font-semibold text-red-400">Factory reset</label>
      <p className="mb-3 text-xs text-white/40">
        Restores every setting to its default and deletes all uploaded videos, images, fonts and
        sounds. Requires the admin password.
      </p>

      {!open ? (
        <button
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500"
        >
          Factory reset…
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Admin password"
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            {busy ? "Resetting…" : "Reset everything"}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {done && <p className="mt-2 text-xs text-white/60">Reset complete — all settings are back to default.</p>}
    </section>
  );
}
