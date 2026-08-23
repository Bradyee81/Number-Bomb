import { createContext, useCallback, useContext, useReducer, type ReactNode } from "react";
import {
  callNumber,
  randomBomb,
  roundReducer,
  startRound as computeStartRound,
  type RoundReducerState,
} from "../lib/roundState";
import { emitEvent } from "../lib/events";

const initialState: RoundReducerState = { current: null, undoSnapshot: null };

interface RoundContextValue {
  state: RoundReducerState;
  startRound: () => void;
  call: (n: number) => void;
  undo: () => void;
  endRound: () => void;
}

const RoundContext = createContext<RoundContextValue | null>(null);

export function RoundProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(roundReducer, initialState);

  const startRound = useCallback(() => {
    const bomb = randomBomb();
    const next = computeStartRound(bomb);
    dispatch({ type: "start", bomb });
    void emitEvent("bomb:round-start", { low: next.low, high: next.high });
  }, []);

  const call = useCallback(
    (n: number) => {
      if (!state.current || state.current.status !== "active") return;
      const { state: next, exploded } = callNumber(state.current, n);
      dispatch({ type: "call", n });
      void emitEvent("bomb:call", { n, low: next.low, high: next.high, exploded });
    },
    [state.current]
  );

  const undo = useCallback(() => {
    if (!state.undoSnapshot) return;
    const snapshot = state.undoSnapshot;
    dispatch({ type: "undo" });
    void emitEvent("bomb:undo", {
      low: snapshot.low,
      high: snapshot.high,
      exploded: snapshot.status === "exploded",
    });
  }, [state.undoSnapshot]);

  const endRound = useCallback(() => {
    if (!state.current) return;
    dispatch({ type: "end" });
    void emitEvent("bomb:round-end", {});
  }, [state.current]);

  return (
    <RoundContext.Provider value={{ state, startRound, call, undo, endRound }}>
      {children}
    </RoundContext.Provider>
  );
}

export function useRound(): RoundContextValue {
  const ctx = useContext(RoundContext);
  if (!ctx) throw new Error("useRound must be used within RoundProvider");
  return ctx;
}
