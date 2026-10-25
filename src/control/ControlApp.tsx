import { useState } from "react";
import { RoundProvider } from "./RoundContext";
import { SettingsProvider, useSettings } from "./SettingsContext";
import { PlayScreen } from "./screens/PlayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { pickScreen, usePresentToggle, useScreens } from "../lib/presentWindow";
import { PopperProvider } from "./PopperContext";

type Screen = "play" | "settings";

function Shell() {
  const [screen, setScreen] = useState<Screen>("play");
  const { presenting, toggle, moveTo } = usePresentToggle();
  const { screens, refresh } = useScreens();
  const { settings, updateSettings } = useSettings();
  const selected = pickScreen(screens, settings?.output_screen ?? "");

  const chooseScreen = (name: string) => {
    void updateSettings({ output_screen: name });
    void moveTo(screens.find((s) => s.name === name));
  };

  return (
    <div className="flex h-screen w-screen text-sm">
      <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-white/10 bg-[#0E1320] p-3">
        <div className="mb-4 px-2 pt-1 text-lg font-bold tracking-tight text-[#F5C518]">
          Number Bomb
        </div>
        {(["play", "settings"] as Screen[]).map((id) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className={`rounded-md px-3 py-2 text-left capitalize transition-colors ${
              screen === id
                ? "bg-[#F5C518] font-semibold text-[#10141F]"
                : "text-white/75 hover:bg-white/5"
            }`}
          >
            {id}
          </button>
        ))}
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <label className="px-1 text-xs uppercase text-white/40">Output screen</label>
          <select
            value={selected?.name ?? ""}
            onFocus={() => void refresh()}
            onChange={(e) => chooseScreen(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-[#10141F] px-2 py-1.5 text-white/80"
          >
            {screens.map((s) => (
              <option key={s.name} value={s.name}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void toggle(selected)}
            className="w-full rounded-md border border-[#F5C518] px-3 py-2 font-semibold text-[#F5C518] hover:bg-[#F5C518]/10"
          >
            {presenting ? "Exit Present" : "Present"}
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {screen === "play" && <PlayScreen />}
        {screen === "settings" && <SettingsScreen />}
      </main>
    </div>
  );
}

export function ControlApp() {
  return (
    <SettingsProvider>
      <PopperProvider>
      <RoundProvider>
        <Shell />
      </RoundProvider>
      </PopperProvider>
    </SettingsProvider>
  );
}
