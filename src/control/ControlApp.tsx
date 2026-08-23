import { useState } from "react";
import { RoundProvider } from "./RoundContext";
import { SettingsProvider } from "./SettingsContext";
import { PlayScreen } from "./screens/PlayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { usePresentToggle } from "../lib/presentWindow";

type Screen = "play" | "settings";

function Shell() {
  const [screen, setScreen] = useState<Screen>("play");
  const { presenting, toggle } = usePresentToggle();

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
        <div className="mt-auto pt-3">
          <button
            onClick={toggle}
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
      <RoundProvider>
        <Shell />
      </RoundProvider>
    </SettingsProvider>
  );
}
