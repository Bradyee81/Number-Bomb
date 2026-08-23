import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { SlotReel } from "../components/SlotReel";
import { useBoundReels } from "./useBoundReels";
import { onEvent } from "../lib/events";
import { loadSettings } from "../lib/settings";
import { ExplosionOverlay } from "./ExplosionOverlay";
import { CenterDisplay } from "./CenterDisplay";
import { playVoiceover } from "../lib/audio";
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
  const prevBoundsRef = useRef<{ low: number; high: number }>({ low: 1, high: 99 });
  const settingsRef = useRef<Settings>(settings);
  const [exploding, setExploding] = useState(false);
  const [revealedBomb, setRevealedBomb] = useState<number | null>(null);
  const handleExplosionDone = useCallback(() => setExploding(false), []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    loadSettings().then(setSettings);
    const unlistens = [
      onEvent("config:updated", setSettings),
      onEvent("bomb:round-start", ({ low, high }) => {
        prevBoundsRef.current = { low, high };
        resetTo(low, high);
        setExploding(false);
        setRevealedBomb(null);
      }),
      onEvent("bomb:call", ({ n, low, high, exploded }) => {
        if (low !== prevBoundsRef.current.low) setLow(low);
        if (high !== prevBoundsRef.current.high) setHigh(high);
        prevBoundsRef.current = { low, high };
        playVoiceover(n, settingsRef.current.voiceover_volume);
        if (exploded) {
          setExploding(true);
          setRevealedBomb(n);
        }
      }),
      onEvent("bomb:undo", ({ low, high, exploded }) => {
        if (low !== prevBoundsRef.current.low) setLow(low);
        if (high !== prevBoundsRef.current.high) setHigh(high);
        prevBoundsRef.current = { low, high };
        if (!exploded) {
          setExploding(false);
          setRevealedBomb(null);
        }
      }),
      onEvent("bomb:round-end", () => {
        prevBoundsRef.current = { low: 1, high: 99 };
        resetTo(1, 99);
        setExploding(false);
        setRevealedBomb(null);
      }),
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
      <CenterDisplay
        centerVideoSrc={settings.center_video_path ? convertFileSrc(settings.center_video_path) : ""}
        centerIconSrc={
          settings.center_icon_path
            ? convertFileSrc(settings.center_icon_path)
            : "/media/center-icon-default.png"
        }
        revealedBomb={revealedBomb}
        size={cellHeight}
      />
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
      {exploding && (
        <ExplosionOverlay
          videoSrc={
            settings.explosion_video_path
              ? convertFileSrc(settings.explosion_video_path)
              : "/media/explosion-default.mp4"
          }
          onDone={handleExplosionDone}
        />
      )}
    </div>
  );
}
