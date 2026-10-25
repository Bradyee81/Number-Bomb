import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePopper } from "./PopperContext";

interface PortInfo {
  name: string;
  label: string;
  chip: "cp210x" | "ch340" | "ftdi" | "other";
}

/** undefined = not checked yet, null = blank board or non-Number-Bomb firmware. */
type BoardFirmware = number | null | undefined;

const PORT_REFRESH_MS = 2000;
const CP210X_DRIVER_URL = "https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers";
const CH340_DRIVER_URL = "https://www.wch-ic.com/downloads/CH341SER_EXE.html";

type StepState = "done" | "todo" | "blocked";

function Step({
  n,
  title,
  state,
  detail,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  detail: ReactNode;
  children?: ReactNode;
}) {
  const badge =
    state === "done"
      ? "bg-emerald-500 text-[#0B0F17]"
      : state === "todo"
        ? "bg-[#F5C518] text-[#0B0F17]"
        : "bg-white/15 text-white/50";
  return (
    <li className={`mb-4 rounded-md border p-3 ${state === "blocked" ? "border-white/5 opacity-70" : "border-white/15"}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
          {state === "done" ? "✓" : n}
        </span>
        <span className="font-semibold">{title}</span>
      </div>
      <div className="mb-2 pl-8 text-xs text-white/60">{detail}</div>
      {children && <div className="pl-8">{children}</div>}
    </li>
  );
}

/** A button that explains why it's disabled, both on hover and underneath. */
function ActionButton({
  label,
  blockedBy,
  onClick,
  primary,
}: {
  label: string;
  blockedBy: string | null;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        disabled={!!blockedBy}
        title={blockedBy ?? undefined}
        onClick={onClick}
        className={
          primary
            ? "rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F] disabled:opacity-40"
            : "rounded-md border border-white/20 px-3 py-1.5 text-sm disabled:opacity-40"
        }
      >
        {label}
      </button>
      {blockedBy && <span className="text-[11px] text-white/45">{blockedBy}</span>}
    </div>
  );
}

export function PopperSetup() {
  const popper = usePopper();
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [portsLoaded, setPortsLoaded] = useState(false);
  const [port, setPort] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [heaterOff, setHeaterOff] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [appFirmware, setAppFirmware] = useState<number | null>(null);
  const [boardFirmware, setBoardFirmware] = useState<BoardFirmware>(undefined);
  const [probing, setProbing] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = popper.busy || probing;

  const refreshPorts = useCallback(async () => {
    try {
      const list = await invoke<PortInfo[]>("popper_ports");
      setPorts(list);
      setPort((current) => (list.some((p) => p.name === current) ? current : list[0]?.name ?? ""));
    } catch (e) {
      setError(String(e));
    } finally {
      setPortsLoaded(true);
    }
  }, []);

  const probe = useCallback(async (name: string) => {
    if (!name || busyRef.current) return;
    setProbing(true);
    try {
      setBoardFirmware(await invoke<number | null>("popper_probe", { port: name }));
    } catch {
      setBoardFirmware(undefined);
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void refreshPorts();
    // Plugging the board in should just make it appear — no Refresh button needed.
    const timer = window.setInterval(() => {
      if (!busyRef.current) void refreshPorts();
    }, PORT_REFRESH_MS);
    void invoke<number | null>("bundled_firmware_version").then(setAppFirmware).catch(() => {});
    void invoke<string | null>("popper_wifi_name").then((name) => { if (name) setSsid(name); }).catch(() => {});
    const unlisten = listen<number>("popper-flash:progress", (e) => setProgress(e.payload));
    return () => {
      clearInterval(timer);
      void unlisten.then((fn) => fn());
    };
  }, [refreshPorts]);

  // Check the firmware once per newly selected board (not while armed: opening the port can restart it).
  useEffect(() => {
    setBoardFirmware(undefined);
    if (port && !popper.armed) void probe(port);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  const run = async (operation: () => Promise<string | void>) => {
    setError("");
    try {
      await popper.setup(operation);
    } catch (e) {
      setError(String(e));
    } finally {
      setProgress(null);
    }
  };

  const selected = ports.find((p) => p.name === port);
  const busy = popper.busy || probing;
  const firmwareCurrent = boardFirmware != null && appFirmware != null && boardFirmware >= appFirmware;

  // Why each action is unavailable, first unmet requirement wins.
  const needUsb = !port ? "Connect the ESP32 by USB (step 2)." : null;
  const needHeater = !heaterOff ? "Tick “heater unplugged” in step 1 first." : null;
  const needIdle = busy ? "Wait for the current operation to finish." : null;
  const flashBlocked = needHeater ?? needUsb ?? needIdle;
  const connectBlocked =
    needHeater ?? needUsb ?? (boardFirmware === null ? "Update the firmware (step 3) first." : null) ??
    (!ssid ? "Enter the WiFi name." : null) ?? needIdle;
  const testBlocked =
    needHeater ?? (!popper.connected ? "Connect the popper to WiFi (step 4) first." : null) ??
    (popper.armed ? "Disarm the popper on the Play screen first." : null) ?? needIdle;

  let usbDetail: ReactNode;
  if (selected) {
    usbDetail = <>Found <span className="text-white/85">{selected.label}</span>.</>;
  } else if (!portsLoaded) {
    usbDetail = "Looking for USB devices…";
  } else {
    usbDetail = (
      <>
        No ESP32 detected. Plug it in with a <b>data</b> USB cable (charge-only cables don't work).
        If it still doesn't appear, install the driver for the chip next to the board's USB socket,
        then unplug and replug the board:
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => void openUrl(CP210X_DRIVER_URL)} className="rounded border border-white/20 px-2 py-1 text-white/80 hover:bg-white/5">
            CP2102 / CP210x driver ↗
          </button>
          <button onClick={() => void openUrl(CH340_DRIVER_URL)} className="rounded border border-white/20 px-2 py-1 text-white/80 hover:bg-white/5">
            CH340 driver ↗
          </button>
        </div>
      </>
    );
  }

  const appLabel = appFirmware != null ? `v${appFirmware}` : "unknown";
  let firmwareDetail: string;
  if (!port) firmwareDetail = `App firmware ${appLabel}. Connect the board to check it.`;
  else if (probing) firmwareDetail = "Checking the board's firmware…";
  else if (boardFirmware === undefined) firmwareDetail = `App firmware ${appLabel}. Board not checked yet.`;
  else if (boardFirmware === null) firmwareDetail = `App firmware ${appLabel} · Board: blank or not Number Bomb firmware — update needed.`;
  else if (firmwareCurrent) firmwareDetail = `App firmware ${appLabel} · Board v${boardFirmware} ✓ up to date.`;
  else firmwareDetail = `App firmware ${appLabel} · Board v${boardFirmware} — update recommended.`;

  return (
    <section className="my-2">
      <h2 className="mb-1 text-lg font-bold">Balloon popper setup</h2>
      <p className="mb-4 text-xs text-white/60">
        Do these once per board, on the event laptop. The laptop and popper must share the same
        2.4GHz WiFi network.
      </p>
      <p className="mb-4 text-sm font-semibold">
        {popper.connected ? "● Popper reachable" : "○ Popper not reachable"} · {popper.armed ? "Armed" : "Disarmed"}
      </p>

      <ol>
        <Step
          n={1}
          title="Safety: heater power off"
          state={heaterOff ? "done" : "todo"}
          detail="Unplug the heater's 12V adapter before connecting USB, flashing or testing."
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={heaterOff} onChange={(e) => setHeaterOff(e.target.checked)} className="h-4 w-4 accent-[#F5C518]" />
            The heater's 12V adapter is unplugged.
          </label>
        </Step>

        <Step n={2} title="Connect the ESP32 by USB" state={selected ? "done" : "todo"} detail={usbDetail}>
          {ports.length > 1 && (
            <select
              aria-label="Popper USB port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="rounded bg-[#10141F] p-2 text-sm"
            >
              {ports.map((p) => (
                <option key={p.name} value={p.name}>{p.label}</option>
              ))}
            </select>
          )}
        </Step>

        <Step
          n={3}
          title="Install popper firmware"
          state={firmwareCurrent ? "done" : port ? "todo" : "blocked"}
          detail={firmwareDetail}
        >
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton
              primary={!firmwareCurrent}
              label={firmwareCurrent ? "Re-install firmware" : "Update popper firmware"}
              blockedBy={flashBlocked}
              onClick={() => {
                setProgress(0);
                void run(async () => {
                  await invoke("flash_popper_firmware", { port });
                  setProgress(null);
                  await probe(port);
                });
              }}
            />
            <ActionButton
              label="Check again"
              blockedBy={needUsb ?? needIdle ?? (popper.armed ? "Disarm first." : null)}
              onClick={() => void probe(port)}
            />
          </div>
          {progress !== null && <p className="mt-2 text-sm" role="status">Firmware update: {progress}%</p>}
          <p className="mt-2 text-[11px] text-white/45">
            If it can't connect, hold the board's BOOT button while flashing starts. Don't unplug while writing.
          </p>
        </Step>

        <Step
          n={4}
          title="Connect to WiFi"
          state={popper.connected ? "done" : firmwareCurrent ? "todo" : "blocked"}
          detail={
            popper.connected
              ? "Popper is on the network and reachable from this laptop."
              : "Enter the venue's 2.4GHz WiFi. Guest networks that isolate devices won't work."
          }
        >
          <label className="mb-2 block text-sm">
            WiFi name
            <input value={ssid} onChange={(e) => setSsid(e.target.value)} className="ml-3 rounded bg-white/10 p-1.5" autoComplete="off" />
          </label>
          <label className="mb-2 block text-sm">
            WiFi password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ml-3 rounded bg-white/10 p-1.5" autoComplete="new-password" />
          </label>
          <p className="mb-2 text-[11px] text-white/45">The password is sent over USB to the ESP32 and isn't saved on this laptop.</p>
          <ActionButton
            primary={!popper.connected}
            label={popper.connected ? "Reconnect" : "Connect"}
            blockedBy={connectBlocked}
            onClick={() =>
              void run(async () => {
                const ip = await invoke<string>("provision_popper", { port, ssid, password });
                setPassword("");
                return `WiFi details sent. Popper address: ${ip}. Checking the connection…`;
              })
            }
          />
        </Step>

        <Step
          n={5}
          title="Relay-only test"
          state={popper.connected ? "todo" : "blocked"}
          detail="With the heater still unplugged: one timer click on, then off after its own two-second interval."
        >
          <ActionButton label="Test relay only" blockedBy={testBlocked} onClick={() => void popper.test()} />
        </Step>
      </ol>

      <p className="mt-2 text-sm" role="status">{popper.message}</p>
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
      <p className="mt-4 text-xs text-white/60">
        Trigger wiring: GPIO25 through 1kΩ to timer Trigger; ESP32 GND to GND_T. Keep the manual
        button. Firmware sends a 100ms trigger; your hardware timer sets the tested two-second
        heater pulse. Never connect a GPIO to COM/NO or heater power.
      </p>
    </section>
  );
}
