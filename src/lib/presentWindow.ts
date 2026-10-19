import { useCallback, useEffect, useState } from "react";
import { availableMonitors, primaryMonitor, Window, type Monitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface PresentableWindow {
  isFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  setPosition(position: Monitor["position"]): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  setFocus(): Promise<void>;
  listen(event: string, handler: () => void): Promise<() => void>;
}

export interface ScreenOption {
  /** OS monitor name, used to remember the choice in settings. */
  name: string;
  label: string;
  primary: boolean;
  monitor: Monitor;
}

async function getOrCreateOutputWindow(): Promise<PresentableWindow> {
  const existing = await Window.getByLabel("output");
  if (existing) return existing;
  const win = new WebviewWindow("output", {
    url: "index.html",
    title: "Number Bomb — Output",
    width: 1920,
    height: 1080,
  });
  await new Promise<void>((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (e) => reject(e));
  });
  return win;
}

/** Lists connected displays, refreshed whenever `refresh` is called (e.g. on dropdown focus). */
export function useScreens() {
  const [screens, setScreens] = useState<ScreenOption[]>([]);

  const refresh = useCallback(async () => {
    const [monitors, primary] = await Promise.all([availableMonitors(), primaryMonitor()]);
    setScreens(
      monitors.map((m, i) => {
        const isPrimary = !!primary && m.name === primary.name;
        return {
          name: m.name ?? `screen-${i + 1}`,
          label: `Screen ${i + 1} — ${m.size.width}×${m.size.height}${isPrimary ? " (main)" : ""}`,
          primary: isPrimary,
          monitor: m,
        };
      }),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { screens, refresh };
}

/** The remembered screen if still connected, else the first non-main screen, else the main one. */
export function pickScreen(screens: ScreenOption[], preferredName: string): ScreenOption | undefined {
  return (
    screens.find((s) => s.name === preferredName) ??
    screens.find((s) => !s.primary) ??
    screens[0]
  );
}

async function presentOn(win: PresentableWindow, screen: ScreenOption | undefined) {
  // Fullscreen applies to whichever monitor the window is on, so move it there first.
  if (await win.isFullscreen().catch(() => false)) await win.setFullscreen(false);
  if (screen) await win.setPosition(screen.monitor.position);
  await win.show();
  await win.setFullscreen(true);
  await win.setFocus();
}

export function usePresentToggle() {
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const win = await Window.getByLabel("output");
      if (win) {
        unlisten = await win.listen("tauri://destroyed", () => setPresenting(false));
      }
    })();
    return () => unlisten?.();
  }, []);

  const toggle = async (screen: ScreenOption | undefined) => {
    const win = await getOrCreateOutputWindow();
    if (presenting) {
      // Exit Present closes the Output screen; it stays alive hidden so Present reopens it instantly.
      await win.setFullscreen(false);
      await win.hide();
      setPresenting(false);
    } else {
      await presentOn(win, screen);
      setPresenting(true);
    }
  };

  /** Moves the Output window to another screen while presenting. */
  const moveTo = async (screen: ScreenOption | undefined) => {
    if (!presenting) return;
    await presentOn(await getOrCreateOutputWindow(), screen);
  };

  return { presenting, toggle, moveTo };
}
