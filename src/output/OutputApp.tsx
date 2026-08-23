import { useEffect, useState } from "react";
import { SlotReel } from "../components/SlotReel";
import { useBoundReels } from "./useBoundReels";
import { onEvent } from "../lib/events";
import { loadSettings } from "../lib/settings";
import {
  DEFAULT_DIGIT_STRIP,
  DEFAULT_SETTINGS,
  DIGIT_CELL_HEIGHT,
  DIGIT_CELL_WIDTH,
  type Settings,
} from "../types";

const CELL_RATIO = DIGIT_CELL_WIDTH / DIGIT_CELL_HEIGHT;

function useReelCellHeight() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const byHeight = size.h * 0.42;
  const byWidth = (size.w * 0.8) / 4 / CELL_RATIO;
  return Math.max(70, Math.min(byHeight, byWidth, 260));
}

export function OutputApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const { statuses, digits, setLow, setHigh, resetTo, markLanded } = useBoundReels();
  const cellHeight = useReelCellHeight();

  useEffect(() => {
    loadSettings().then(setSettings);
    const unlistens = [
      onEvent("config:updated", setSettings),
      onEvent("bomb:round-start", ({ low, high }) => resetTo(low, high)),
      onEvent("bomb:call", ({ low, high, exploded }) => {
        setLow(low);
        setHigh(high);
        void exploded; // explosion overlay wiring lands in Task 9
      }),
      onEvent("bomb:undo", ({ low, high }) => {
        setLow(low);
        setHigh(high);
      }),
      onEvent("bomb:round-end", () => resetTo(1, 99)),
    ];
    return () => {
      unlistens.forEach((p) => p.then((fn) => fn()));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripUrl = DEFAULT_DIGIT_STRIP;

  return (
    <div
      className="flex h-screen w-screen items-center justify-center gap-10 overflow-hidden"
      style={{ backgroundColor: settings.chroma_color }}
    >
      <div className="flex gap-3">
        <SlotReel
          stripUrl={stripUrl}
          status={statuses.lowTens}
          digit={digits.lowTens}
          cellHeight={cellHeight}
          onLanded={() => markLanded("lowTens")}
        />
        <SlotReel
          stripUrl={stripUrl}
          status={statuses.lowUnits}
          digit={digits.lowUnits}
          cellHeight={cellHeight}
          onLanded={() => markLanded("lowUnits")}
        />
      </div>
      <div className="flex gap-3">
        <SlotReel
          stripUrl={stripUrl}
          status={statuses.highTens}
          digit={digits.highTens}
          cellHeight={cellHeight}
          onLanded={() => markLanded("highTens")}
        />
        <SlotReel
          stripUrl={stripUrl}
          status={statuses.highUnits}
          digit={digits.highUnits}
          cellHeight={cellHeight}
          onLanded={() => markLanded("highUnits")}
        />
      </div>
    </div>
  );
}
