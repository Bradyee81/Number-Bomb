import { createContext, useCallback, useContext, useReducer, useState, type ReactNode } from "react";
import {
  callNumber,
  randomBomb,
  roundReducer,
  startRound as computeStartRound,
  type RoundReducerState,
} from "../lib/roundState";
import { emitEvent } from "../lib/events";
import { usePopper } from "./PopperContext";

const initialState: RoundReducerState = { current: null, undoSnapshot: null };

interface RoundContextValue {
  state: RoundReducerState;
  startRound: () => void;
  call: (n: number) => void;
  undo: () => void;
  endRound: () => void;
  /** Whether the bomb number is currently shown on the Output screen. */
  bombShown: boolean;
  toggleBombShown: () => void;
}

const RoundContext = createContext<RoundContextValue | null>(null);

export function RoundProvider({ children }: { children: ReactNode }) {
  const { beginRound: beginPopperRound, disarm: disarmPopper, fire: firePopper } = usePopper();
  const [state, dispatch] = useReducer(roundReducer, initialState);
  const [bombShown, setBombShown] = useState(false);

  const startRound = useCallback(() => {
    beginPopperRound();
    const bomb = randomBomb();
    const next = computeStartRound(bomb);
    dispatch({ type: "start", bomb });
    setBombShown(false);
    void emitEvent("bomb:round-start", { low: next.low, high: next.high });
  }, [beginPopperRound]);

  const call = useCallback(
    (n: number) => {
      if (!state.current || state.current.status !== "active") return;
      const { state: next, exploded } = callNumber(state.current, n);
      dispatch({ type: "call", n });
      void emitEvent("bomb:call", {
        n,
        low: exploded ? n : next.low,
        high: exploded ? n : next.high,
        exploded,
      });
      if (exploded) { setBombShown(true); firePopper(); }
    },
    [state.current, firePopper]
  );

  const undo = useCallback(() => {
    if (!state.undoSnapshot) return;
    const snapshot = state.undoSnapshot;
    disarmPopper();
    dispatch({ type: "undo" });
    setBombShown(false);
    void emitEvent("bomb:undo", {
      low: snapshot.low,
      high: snapshot.high,
      exploded: snapshot.status === "exploded",
    });
  }, [state.undoSnapshot, disarmPopper]);

  const endRound = useCallback(() => {
    disarmPopper();
    if (!state.current) return;
    dispatch({ type: "end" });
    setBombShown(false);
    void emitEvent("bomb:round-end", {});
  }, [state.current, disarmPopper]);

  const toggleBombShown = useCallback(() => {
    if (!state.current) return;
    const show = !bombShown;
    setBombShown(show);
    void emitEvent("bomb:reveal", { bomb: show ? state.current.bomb : null });
  }, [state.current, bombShown]);

  return (
    <RoundContext.Provider value={{ state, startRound, call, undo, endRound, bombShown, toggleBombShown }}>
      {children}
    </RoundContext.Provider>
  );
}

export function useRound(): RoundContextValue {
  const ctx = useContext(RoundContext);
  if (!ctx) throw new Error("useRound must be used within RoundProvider");
  return ctx;
}
