import { exists, mkdir, readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { DEFAULT_SETTINGS, type Settings } from "../types";

const SETTINGS_FILE = "config.json";

export async function loadSettings(): Promise<Settings> {
  try {
    const found = await exists(SETTINGS_FILE, { baseDir: BaseDirectory.AppConfig });
    if (!found) return DEFAULT_SETTINGS;
    const raw = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppConfig });
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
  await writeTextFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    baseDir: BaseDirectory.AppConfig,
  });
}
