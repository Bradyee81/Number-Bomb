import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePopper } from "./PopperContext";

export function PopperSetup() {
  const popper = usePopper();
  const [ports, setPorts] = useState<string[]>([]);
  const [port, setPort] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [heaterOff, setHeaterOff] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const refreshPorts = async () => {
    try {
      const list = await invoke<string[]>("popper_ports");
      setPorts(list); setPort(current => list.includes(current) ? current : list[0] || "");
    } catch (e) { setError(String(e)); }
  };
  useEffect(() => {
    void refreshPorts();
    void invoke<string | null>("popper_wifi_name").then(name => { if (name) setSsid(name); }).catch(() => {});
    const unlisten = listen<number>("popper-flash:progress", e => setProgress(e.payload));
    return () => { void unlisten.then(fn => fn()); };
  }, []);
  const run = async (operation: () => Promise<string | void>) => {
    setError("");
    try { await popper.setup(operation); } catch (e) { setError(String(e)); }
    finally { setProgress(null); }
  };
  const button = "rounded border border-white/20 px-3 py-2 disabled:opacity-40";
  return <section className="my-8 rounded-lg border border-white/15 p-5">
    <h2 className="mb-2 text-lg font-bold">Balloon popper setup</h2>
    <p className="mb-3 text-white/70">On the event laptop, connect the ESP32 by USB. Flash it once, then send the venue’s 2.4GHz WiFi details. The laptop and popper must share the same local network.</p>
    <p className="mb-3 font-semibold">{popper.connected ? "● Popper reachable" : "○ Popper not reachable"} · {popper.armed ? "Armed" : "Disarmed"}</p>
    <label className="mb-3 flex gap-2"><input type="checkbox" checked={heaterOff} onChange={e => setHeaterOff(e.target.checked)} />The heater’s 12V adapter is unplugged.</label>
    <div className="mb-3 flex gap-2">
      <select aria-label="Popper USB port" value={port} onChange={e => setPort(e.target.value)} className="rounded bg-[#10141F] p-2">
        {!ports.length && <option value="">No USB device found</option>}
        {ports.map(p => <option key={p}>{p}</option>)}
      </select>
      <button className={button} disabled={popper.busy} onClick={() => void refreshPorts()}>Refresh USB</button>
      <button className={button} disabled={!port || !heaterOff || popper.busy} onClick={() => {
        setProgress(0);
        void run(async () => { await invoke("flash_popper_firmware", { port }); setProgress(null); });
      }}>Update popper firmware</button>
    </div>
    {progress !== null && <p role="status">Firmware update: {progress}%</p>}
    <label className="mb-2 block">WiFi name<input value={ssid} onChange={e => setSsid(e.target.value)} className="ml-3 rounded bg-white/10 p-2" autoComplete="off" /></label>
    <label className="mb-3 block">WiFi password<input type="password" value={password} onChange={e => setPassword(e.target.value)} className="ml-3 rounded bg-white/10 p-2" autoComplete="new-password" /></label>
    <p className="mb-3 text-xs text-white/60">Password is sent over USB to the ESP32 and isn’t saved by the laptop.</p>
    <div className="flex gap-2">
      <button className={button} disabled={!port || !ssid || !heaterOff || popper.busy} onClick={() => void run(async () => {
        const ip = await invoke<string>("provision_popper", { port, ssid, password }); setPassword("");
        return `WiFi details sent. Popper address: ${ip}. Checking the connection…`;
      })}>Connect</button>
      <button className={button} disabled={!heaterOff || !popper.connected || popper.busy || popper.armed} onClick={() => void popper.test()}>Test relay only</button>
    </div>
    <p className="mt-3" role="status">{popper.message}</p>
    {error && <p className="mt-2 text-red-300" role="alert">{error}</p>}
    <p className="mt-3 text-xs text-white/60">Trigger wiring: GPIO25 through 1kΩ to timer Trigger; ESP32 GND to GND_T. Keep the manual button. Firmware sends a 100ms trigger; your hardware timer sets the tested two-second heater pulse. Never connect a GPIO to COM/NO or heater power.</p>
  </section>;
}
