import { describe, it, expect } from "vitest";
import { PopperGate } from "./popperGate";

describe("physical popper one-shot gate", () => {
  it("never fires without explicitly arming a started round", () => {
    const gate = new PopperGate();
    expect(gate.consume()).toBeNull();
    expect(gate.arm("")).toBe(false);
    gate.begin("a");
    expect(gate.consume()).toBeNull();
    expect(gate.arm("stale-round")).toBe(false);
  });
  it("consumes before sending, so failures, duplicate calls and undo cannot retry", () => {
    const gate = new PopperGate(); gate.begin("a"); gate.arm("a");
    expect(gate.consume()).toBe("a");
    expect(gate.consume()).toBeNull();
    expect(gate.arm("a")).toBe(false);
  });
  it("new rounds and disconnects need another explicit arm", () => {
    const gate = new PopperGate(); gate.begin("a"); gate.arm("a");
    gate.disarm(); expect(gate.consume()).toBeNull();
    gate.begin("b"); expect(gate.consume()).toBeNull();
    expect(gate.arm("a")).toBe(false);
    gate.arm("b"); expect(gate.consume()).toBe("b");
  });
  it("a losing number received while disarmed rejects a late arm acknowledgement", () => {
    const gate = new PopperGate(); gate.begin("a");
    expect(gate.finish()).toBeNull();
    expect(gate.arm("a")).toBe(false);
    expect(gate.consume()).toBeNull();
  });
});
