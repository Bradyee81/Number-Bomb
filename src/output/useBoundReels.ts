import { useCallback, useRef, useState } from "react";
import type { ReelStatus } from "../components/SlotReel";
import { STAGGER_MS } from "../lib/reelTiming";

export type ReelKey = "lowTens" | "lowUnits" | "highTens" | "highUnits";
const REEL_KEYS: ReelKey[] = ["lowTens", "lowUnits", "highTens", "highUnits"];

function toTensUnits(n: number): [number, number] {
  const clamped = Math.max(0, Math.min(99, n));
  return [Math.floor(clamped / 10), clamped % 10];
}

export function useBoundReels() {
  const [statuses, setStatuses] = useState<Record<ReelKey, ReelStatus>>({
    lowTens: "locked",
    lowUnits: "locked",
    highTens: "locked",
    highUnits: "locked",
  });
  const [digits, setDigits] = useState<Record<ReelKey, number | null>>({
    lowTens: 0,
    lowUnits: 1,
    highTens: 9,
    highUnits: 9,
  });
  const timeoutsRef = useRef<Map<ReelKey, ReturnType<typeof setTimeout>>>(new Map());

  const clearPending = useCallback((key: ReelKey) => {
    const t = timeoutsRef.current.get(key);
    if (t) {
      clearTimeout(t);
      timeoutsRef.current.delete(key);
    }
  }, []);

  const animatePair = useCallback(
    (tensKey: ReelKey, unitsKey: ReelKey, value: number) => {
      const [tens, units] = toTensUnits(value);
      const targets: Partial<Record<ReelKey, number>> = { [tensKey]: tens, [unitsKey]: units };

      [tensKey, unitsKey].forEach((key, i) => {
        clearPending(key);
        const t = setTimeout(() => {
          timeoutsRef.current.delete(key);
          setDigits((prev) => ({ ...prev, [key]: targets[key]! }));
          setStatuses((prev) => ({ ...prev, [key]: "landing" }));
        }, i * STAGGER_MS);
        timeoutsRef.current.set(key, t);
      });
    },
    [clearPending]
  );

  const setLow = useCallback((value: number) => animatePair("lowTens", "lowUnits", value), [animatePair]);
  const setHigh = useCallback((value: number) => animatePair("highTens", "highUnits", value), [animatePair]);

  const resetTo = useCallback(
    (low: number, high: number) => {
      animatePair("lowTens", "lowUnits", low);
      animatePair("highTens", "highUnits", high);
    },
    [animatePair]
  );

  const markLanded = useCallback((key: ReelKey) => {
    setStatuses((prev) => (prev[key] !== "landing" ? prev : { ...prev, [key]: "locked" }));
  }, []);

  return { statuses, digits, setLow, setHigh, resetTo, markLanded, keys: REEL_KEYS };
}
