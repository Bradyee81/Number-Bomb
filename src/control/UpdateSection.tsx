import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; percent: number | null }
  | { kind: "error"; message: string };

export function UpdateSection() {
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const checkForUpdate = async () => {
    setStatus({ kind: "checking" });
    try {
      const update = await check();
      setStatus(update ? { kind: "available", update } : { kind: "latest" });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  };

  const install = async (update: Update) => {
    let total = 0;
    let received = 0;
    setStatus({ kind: "downloading", percent: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          setStatus({
            kind: "downloading",
            percent: total ? Math.round((received / total) * 100) : null,
          });
        }
      });
      await relaunch();
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  };

  const busy = status.kind === "checking" || status.kind === "downloading";

  return (
    <section className="mt-8">
      <label className="mb-2 block font-semibold">App updates</label>
      <p className="mb-2 text-xs text-white/40">
        Installed version {version ? `v${version}` : "…"}. Installing an update restarts the app.
      </p>

      {status.kind === "available" ? (
        <button
          type="button"
          onClick={() => install(status.update)}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F]"
        >
          Install v{status.update.version} and restart
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={checkForUpdate}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40"
        >
          {status.kind === "checking"
            ? "Checking…"
            : status.kind === "downloading"
              ? `Downloading${status.percent === null ? "…" : ` ${status.percent}%`}`
              : "Check for updates"}
        </button>
      )}

      {status.kind === "latest" && (
        <p className="mt-2 text-xs text-white/60">You're on the latest version.</p>
      )}
      {status.kind === "available" && status.update.body && (
        <p className="mt-2 whitespace-pre-line text-xs text-white/60">{status.update.body}</p>
      )}
      {status.kind === "error" && (
        <p className="mt-2 text-xs text-red-400">Update failed: {status.message}</p>
      )}
    </section>
  );
}
