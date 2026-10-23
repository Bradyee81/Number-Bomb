import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { SlotReel } from "../components/SlotReel";
import { useBoundReels } from "./useBoundReels";
import { onEvent } from "../lib/events";
import { loadSettings } from "../lib/settings";
import { ExplosionOverlay } from "./ExplosionOverlay";
import { CenterDisplay } from "./CenterDisplay";
import { playBombHit, playCallAnnouncement } from "../lib/audio";
import {
  CUSTOM_FONT_FAMILY_NAME,
  DEFAULT_DIGIT_STRIP,
  DEFAULT_SETTINGS,
  isVideoPath,
  type Settings,
} from "../types";

// Reel size at a 1920×1080 output with output_scale = 1.
const BASE_CELL_HEIGHT = 260;
const FONT_PREVIEW_MS = 3000;

/** Scales the 1920×1080 layout to the window, so it looks the same at any resolution. */
function useViewportScale() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return Math.min(size.w / 1920, size.h / 1080);
}

export function OutputApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const { statuses, digits, setLow, setHigh, resetTo, markLanded } = useBoundReels();
  const viewportScale = useViewportScale();
  const scale = viewportScale * settings.output_scale;
  const cellHeight = Math.max(40, BASE_CELL_HEIGHT * scale);
  const prevBoundsRef = useRef<{ low: number; high: number }>({ low: 1, high: 99 });
  const settingsRef = useRef<Settings>(settings);
  const [exploding, setExploding] = useState(false);
  const [revealedBomb, setRevealedBomb] = useState<number | null>(null);
  const [fontPreview, setFontPreview] = useState(false);
  const handleExplosionDone = useCallback(() => setExploding(false), []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!settings.custom_font_path) return;
    const url = convertFileSrc(settings.custom_font_path);
    const fontFace = new FontFace(CUSTOM_FONT_FAMILY_NAME, `url("${url}")`);
    let cancelled = false;
    fontFace
      .load()
      .then((loaded) => {
        if (!cancelled) document.fonts.add(loaded);
      })
      .catch(() => {
        // custom font failed to load — bomb text falls back to the browser's
        // default font for an unresolved family name, same non-blocking
        // posture as the video/image fallbacks elsewhere in this window.
      });
    return () => {
      cancelled = true;
    };
  }, [settings.custom_font_path]);

  useEffect(() => {
    loadSettings().then(setSettings);
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
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
        if (exploded) {
          playBombHit(n, settingsRef.current);
          setExploding(settingsRef.current.explosion_enabled);
          setRevealedBomb(n);
        } else {
          playCallAnnouncement(low, high, settingsRef.current);
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
      onEvent("bomb:reveal", ({ bomb }) => setRevealedBomb(bomb)),
      onEvent("display:preview-font", () => {
        setFontPreview(true);
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => setFontPreview(false), FONT_PREVIEW_MS);
      }),
      onEvent("bomb:round-end", () => {
        prevBoundsRef.current = { low: 1, high: 99 };
        resetTo(1, 99);
        setExploding(false);
        setRevealedBomb(null);
      }),
    ];
    return () => {
      clearTimeout(previewTimer);
      unlistens.forEach((p) => p.then((fn) => fn()));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripUrl = settings.digit_strip_path
    ? convertFileSrc(settings.digit_strip_path)
    : DEFAULT_DIGIT_STRIP;

  return (
    <div
      className="relative isolate flex h-screen w-screen items-center justify-center gap-10 overflow-hidden"
      style={{ backgroundColor: settings.chroma_color }}
    >
      {settings.background_path &&
        (isVideoPath(settings.background_path) ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={convertFileSrc(settings.background_path)}
            autoPlay
            loop
            muted
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : (
          <img
            src={convertFileSrc(settings.background_path)}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ))}
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
        revealedBomb={revealedBomb ?? (fontPreview ? 88 : null)}
        size={cellHeight * 2}
        bombFontFamily={settings.bomb_font_family}
        bombFontSizePx={settings.bomb_font_size_px * scale}
        bombColor={settings.bomb_font_color}
        bombOutlineColor={settings.bomb_outline_enabled ? settings.bomb_outline_color : null}
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
