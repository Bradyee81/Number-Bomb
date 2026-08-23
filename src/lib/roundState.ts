export type RoundStatus = "active" | "exploded" | "ended";

export interface RoundState {
  bomb: number;
  low: number;
  high: number;
  status: RoundStatus;
}

export interface CallResult {
  state: RoundState;
  exploded: boolean;
}

export function randomBomb(low = 1, high = 99): number {
  return low + Math.floor(Math.random() * (high - low + 1));
}

export function startRound(bomb: number): RoundState {
  return { bomb, low: 1, high: 99, status: "active" };
}

export function endRound(state: RoundState): RoundState {
  return { ...state, status: "ended" };
}

export function callNumber(state: RoundState, n: number): CallResult {
  if (n === state.bomb) {
    return { state: { ...state, status: "exploded" }, exploded: true };
  }
  if (n < state.bomb) {
    return { state: { ...state, low: n }, exploded: false };
  }
  return { state: { ...state, high: n }, exploded: false };
}

export interface RoundReducerState {
  current: RoundState | null;
  undoSnapshot: RoundState | null;
}

export type RoundAction =
  | { type: "start"; bomb: number }
  | { type: "call"; n: number }
  | { type: "undo" }
  | { type: "end" };

export function roundReducer(state: RoundReducerState, action: RoundAction): RoundReducerState {
  switch (action.type) {
    case "start":
      return { current: startRound(action.bomb), undoSnapshot: null };
    case "call": {
      if (!state.current || state.current.status !== "active") return state;
      const { state: next } = callNumber(state.current, action.n);
      return { current: next, undoSnapshot: state.current };
    }
    case "undo":
      if (!state.undoSnapshot) return state;
      return { current: state.undoSnapshot, undoSnapshot: null };
    case "end":
      if (!state.current) return state;
      return { current: endRound(state.current), undoSnapshot: null };
    default:
      return state;
  }
}
