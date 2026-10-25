import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PopperGate } from "../lib/popperGate";

interface DeviceStatus { firmware: number; boot: string; challenge: string; armed_round: string }
interface PopperValue {
  connected: boolean; armed: boolean; consumed: boolean; busy: boolean; message: string;
  beginRound: () => void; disarm: () => void; arm: () => Promise<void>;
  fire: () => void; test: () => Promise<void>; refresh: () => Promise<void>;
  setup: (operation: () => Promise<string | void>) => Promise<void>;
}
const Context = createContext<PopperValue | null>(null);
// Keep in sync with MAX_MISSED_POLLS in src-tauri/src/popper.rs. A single slow
// WiFi reply is not a disconnect; the device's 5s lease is the hard backstop.
const MAX_MISSED_POLLS = 3;
const command = (verb: string, round: string) => invoke<void>("popper_action", { verb, round, requestedAt: Date.now() });

export function PopperProvider({ children }: { children: ReactNode }) {
  const gate = useRef(new PopperGate());
  const epoch = useRef(0);
  const occupied = useRef(false);
  const connectedRef = useRef(false);
  const missedPolls = useRef(0);
  const [connected, setConnected] = useState(false);
  const [armed, setArmed] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Popper not connected. Set it up in Settings.");
  const setConnection = (value: boolean) => { connectedRef.current = value; setConnected(value); };

  const refresh = useCallback(async () => {
    if (occupied.current) return;
    occupied.current = true;
    const round = gate.current.armed ? gate.current.round : null;
    try {
      const status = await invoke<DeviceStatus | null>("popper_status", { keepalive: round });
      // A foreground command cancelled this background check. It is neither
      // a disconnect nor an authoritative status response.
      if (!status) return;
      const recovered = missedPolls.current > 0;
      missedPolls.current = 0;
      setConnection(true);
      if (recovered && gate.current.armed && status.armed_round === gate.current.round) {
        setMessage("Armed for this round. A losing number will trigger the timer once.");
      }
      if (gate.current.armed && status.armed_round !== gate.current.round) {
        gate.current.disarm(); setArmed(false);
        setMessage("Popper disarmed. Arm this round again when ready.");
      }
    } catch {
      missedPolls.current += 1;
      if (missedPolls.current < MAX_MISSED_POLLS) {
        if (gate.current.armed) setMessage("Popper slow to reply — still armed, checking again…");
        return;
      }
      setConnection(false);
      if (gate.current.armed) setMessage("Connection lost. No automatic firing or re-arming.");
      gate.current.disarm(); setArmed(false);
    } finally { occupied.current = false; }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    const onHide = () => { if (document.visibilityState === "hidden") {
      epoch.current++;
      gate.current.disarm(); setArmed(false);
      if (connectedRef.current) void command("disarm", "").catch(() => {});
    } };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onHide); };
  }, [refresh]);

  const disarm = useCallback(() => {
    epoch.current++;
    gate.current.disarm(); setArmed(false);
    if (connectedRef.current) void command("disarm", "").catch(() => {});
  }, []);
  const beginRound = useCallback(() => {
    disarm(); gate.current.begin(crypto.randomUUID()); setConsumed(false);
    setMessage("New round. Arm the popper when the balloon is ready.");
  }, [disarm]);

  const arm = async () => {
    if (occupied.current || !gate.current.round || gate.current.consumed) return;
    const round = gate.current.round;
    const armingEpoch = epoch.current;
    occupied.current = true; setBusy(true);
    try {
      await command("arm", round);
      if (epoch.current === armingEpoch && gate.current.arm(round)) {
        setArmed(true); setConnection(true);
        setMessage("Armed for this round. A losing number will trigger the timer once.");
      } else { await command("disarm", ""); }
    } catch (e) { gate.current.disarm(); setArmed(false); setMessage(String(e)); }
    finally { occupied.current = false; setBusy(false); }
  };

  const fire = useCallback(() => {
    epoch.current++;
    const round = gate.current.finish();
    setArmed(false);
    if (!round) {
      setConsumed(true);
      if (connectedRef.current) void command("disarm", "").catch(() => {});
      setMessage("Round ended with the popper disarmed. No trigger sent.");
      return;
    }
    setConsumed(true);
    // Do not await a poll/operation: backend also rejects requests older than 750ms.
    setMessage("Sending one trigger…");
    void command("fire", round).then(() => {
      if (gate.current.round !== round) return;
      setMessage("Trigger accepted by ESP32. Check the balloon; start a new round to re-arm.");
    }).catch((e) => {
      if (gate.current.round !== round) return;
      setMessage(`Trigger not confirmed. No automatic retry. Use the manual backup if needed. ${String(e)}`);
    });
  }, []);

  const setup = async (operation: () => Promise<string | void>) => {
    if (occupied.current) throw new Error("Wait a moment, then try again.");
    disarm(); occupied.current = true; setBusy(true); setArmed(false);
    try { const result = await operation(); setMessage(result || "Firmware updated. Press Connect to send WiFi details."); }
    catch (e) { setMessage(String(e)); throw e; }
    finally { occupied.current = false; setBusy(false); }
    await refresh();
  };

  const test = async () => {
    if (occupied.current || gate.current.armed) return;
    occupied.current = true; setBusy(true);
    const id = `test-${crypto.randomUUID()}`;
    try {
      await command("arm", id);
      await command("fire", id);
      setMessage("Relay-test trigger accepted. Listen for the timer clicks; heater power must stay disconnected.");
    } catch (e) { setMessage(`Test not confirmed; no automatic retry. ${String(e)}`); }
    finally {
      void command("disarm", "").catch(() => {});
      occupied.current = false; setBusy(false);
    }
  };

  return <Context.Provider value={{ connected, armed, consumed, busy, message, beginRound, disarm, arm, fire, test, refresh, setup }}>{children}</Context.Provider>;
}

export function usePopper() {
  const value = useContext(Context);
  if (!value) throw new Error("PopperProvider missing");
  return value;
}
