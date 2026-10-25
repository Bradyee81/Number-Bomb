import { useState, type FormEvent } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useRound } from "../RoundContext";
import { usePopper } from "../PopperContext";

export function PlayScreen() {
  const popper = usePopper();
  const { state, startRound, call, undo, endRound, bombShown, toggleBombShown } = useRound();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bombRevealed, setBombRevealed] = useState(false);
  const [bombPinned, setBombPinned] = useState(false);
  const showBomb = bombRevealed || bombPinned;
  const round = state.current;
  const canPlay = round?.status === "active";

  const toggleOutputReveal = async () => {
    if (!bombShown) {
      const ok = await confirm("Show the bomb number to the audience on the Output screen?", {
        title: "Show bomb on Output",
        kind: "warning",
        okLabel: "Show it",
        cancelLabel: "Cancel",
      });
      if (!ok) return;
    }
    toggleBombShown();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || !canPlay || !round) {
      setInput("");
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      setError("Enter a whole number");
      return;
    }
    if (n < 1 || n > 99) {
      setError("Must be between 1 and 99");
      return;
    }
    if (n < round.low || n > round.high) {
      setError(`Out of range — must be from ${round.low} to ${round.high}`);
      return;
    }
    setError(null);
    call(n);
    setInput("");
  };

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-1 text-xl font-bold">Play</h1>
      <p className="mb-6 text-white/60">Enter the number a player calls, then press Enter.</p>
      <div className="mb-5 rounded border border-white/15 p-3">
        <div className="mb-2 font-semibold">Balloon popper · {popper.armed ? "ARMED" : "Disarmed"} · {popper.connected ? "Connected" : "Not connected"}</div>
        <div className="mb-2 flex gap-2">
          <button disabled={!canPlay || !popper.connected || popper.busy || popper.armed || popper.consumed}
            onClick={() => void popper.arm()} className="rounded bg-red-700 px-3 py-2 font-semibold disabled:opacity-40">Arm this round</button>
          <button onClick={popper.disarm} className="rounded border border-white/25 px-3 py-2">Disarm</button>
        </div>
        <p className="text-xs text-white/70" role="status">{popper.message}</p>
      </div>

      <div className="mb-6 flex items-center gap-6 rounded-md border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <div className="text-xs uppercase text-white/40">Low</div>
          <div className="text-2xl font-bold text-[#F5C518]">
            {round ? String(round.low).padStart(2, "0") : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-white/40">High</div>
          <div className="text-2xl font-bold text-[#F5C518]">
            {round ? String(round.high).padStart(2, "0") : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-white/40">Status</div>
          <div className="text-lg font-semibold capitalize">{round?.status ?? "no round"}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-white/40">Bomb</div>
          <button
            type="button"
            onMouseDown={() => setBombRevealed(true)}
            onMouseUp={() => setBombRevealed(false)}
            onMouseLeave={() => setBombRevealed(false)}
            onTouchStart={() => setBombRevealed(true)}
            onTouchEnd={() => setBombRevealed(false)}
            onTouchCancel={() => setBombRevealed(false)}
            disabled={!round}
            className="select-none text-2xl font-bold text-[#F5C518] disabled:opacity-40"
          >
            {round && showBomb ? String(round.bomb).padStart(2, "0") : "••"}
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="mb-4 flex gap-3">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null);
          }}
          disabled={!canPlay}
          inputMode="numeric"
          placeholder="Number called"
          className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-[#F5C518] disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!canPlay}
          className="rounded-md bg-[#F5C518] px-4 py-2 font-semibold text-[#10141F] disabled:opacity-40"
        >
          Enter
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={undo}
          disabled={!state.undoSnapshot}
          className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={() => {
            setBombPinned(false);
            startRound();
          }}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F]"
        >
          Start Round
        </button>
        <button
          onClick={() => setBombPinned((v) => !v)}
          disabled={!round}
          title="Shows the bomb number here on the Control screen only"
          className="rounded-md border border-[#F5C518]/60 px-3 py-1.5 text-[#F5C518] hover:bg-[#F5C518]/10 disabled:opacity-40"
        >
          {bombPinned ? "Hide Bomb" : "Reveal Bomb"}
        </button>
        <button
          onClick={toggleOutputReveal}
          disabled={!round || round.status === "exploded"}
          title="Shows the bomb number to the audience on the Output screen"
          className={`rounded-md px-3 py-1.5 font-semibold disabled:opacity-40 ${
            bombShown
              ? "border border-red-500 text-red-400 hover:bg-red-500/10"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {bombShown ? "Hide on Output" : "Show on Output"}
        </button>
        <button
          onClick={endRound}
          disabled={!round || round.status === "ended"}
          className="rounded-md border border-white/15 px-3 py-1.5 text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          End Round
        </button>
      </div>
    </div>
  );
}
