import { describe, expect, it } from "vitest";
import { callNumber, endRound, roundReducer, startRound } from "./roundState";
import type { RoundReducerState } from "./roundState";

describe("startRound", () => {
  it("resets to the full 1-99 range and active status", () => {
    const state = startRound(42);
    expect(state).toEqual({ bomb: 42, low: 1, high: 99, status: "active" });
  });
});

describe("callNumber", () => {
  it("narrows the lower bound when the call is below the bomb", () => {
    const state = startRound(50);
    const result = callNumber(state, 20);
    expect(result.exploded).toBe(false);
    expect(result.state).toEqual({ bomb: 50, low: 20, high: 99, status: "active" });
  });

  it("narrows the upper bound when the call is above the bomb", () => {
    const state = startRound(50);
    const result = callNumber(state, 80);
    expect(result.exploded).toBe(false);
    expect(result.state).toEqual({ bomb: 50, low: 1, high: 80, status: "active" });
  });

  it("marks exploded when the call matches the bomb exactly", () => {
    const state = startRound(50);
    const result = callNumber(state, 50);
    expect(result.exploded).toBe(true);
    expect(result.state.status).toBe("exploded");
    expect(result.state.low).toBe(1);
    expect(result.state.high).toBe(99);
  });
});

describe("endRound", () => {
  it("sets status to ended without altering bounds", () => {
    const state = startRound(50);
    expect(endRound(state)).toEqual({ bomb: 50, low: 1, high: 99, status: "ended" });
  });
});

describe("roundReducer", () => {
  const empty: RoundReducerState = { current: null, undoSnapshot: null };

  it("start creates an active round and clears any undo snapshot", () => {
    const next = roundReducer(empty, { type: "start", bomb: 7 });
    expect(next.current).toEqual({ bomb: 7, low: 1, high: 99, status: "active" });
    expect(next.undoSnapshot).toBeNull();
  });

  it("call narrows the round and snapshots the prior state for undo", () => {
    const started = roundReducer(empty, { type: "start", bomb: 30 });
    const called = roundReducer(started, { type: "call", n: 10 });
    expect(called.current).toEqual({ bomb: 30, low: 10, high: 99, status: "active" });
    expect(called.undoSnapshot).toEqual({ bomb: 30, low: 1, high: 99, status: "active" });
  });

  it("call is ignored when there is no active round", () => {
    const called = roundReducer(empty, { type: "call", n: 10 });
    expect(called).toBe(empty);
  });

  it("call is ignored once the round has exploded", () => {
    const started = roundReducer(empty, { type: "start", bomb: 5 });
    const exploded = roundReducer(started, { type: "call", n: 5 });
    const again = roundReducer(exploded, { type: "call", n: 10 });
    expect(again).toBe(exploded);
  });

  it("undo restores the exact prior state, including reversing an explosion", () => {
    const started = roundReducer(empty, { type: "start", bomb: 5 });
    const exploded = roundReducer(started, { type: "call", n: 5 });
    expect(exploded.current?.status).toBe("exploded");

    const undone = roundReducer(exploded, { type: "undo" });
    expect(undone.current).toEqual(started.current);
    expect(undone.undoSnapshot).toBeNull();
  });

  it("undo only works once — the snapshot is consumed", () => {
    const started = roundReducer(empty, { type: "start", bomb: 30 });
    const firstCall = roundReducer(started, { type: "call", n: 10 });
    const secondCall = roundReducer(firstCall, { type: "call", n: 60 });
    const undoneOnce = roundReducer(secondCall, { type: "undo" });
    expect(undoneOnce.current).toEqual(firstCall.current);

    const undoneTwice = roundReducer(undoneOnce, { type: "undo" });
    expect(undoneTwice).toBe(undoneOnce);
  });

  it("end sets status to ended and clears the undo snapshot", () => {
    const started = roundReducer(empty, { type: "start", bomb: 30 });
    const called = roundReducer(started, { type: "call", n: 10 });
    const ended = roundReducer(called, { type: "end" });
    expect(ended.current?.status).toBe("ended");
    expect(ended.undoSnapshot).toBeNull();
  });
});
