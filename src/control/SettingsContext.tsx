import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadSettings, saveSettings } from "../lib/settings";
import { emitEvent } from "../lib/events";
import { DEFAULT_SETTINGS, type Settings } from "../types";

interface SettingsContextValue {
  settings: Settings | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...(settings ?? DEFAULT_SETTINGS), ...patch };
      setSettings(next);
      await saveSettings(next);
      await emitEvent("config:updated", next);
    },
    [settings]
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
