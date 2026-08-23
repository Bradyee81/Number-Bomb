import { useState, type FormEvent } from "react";
import { useRound } from "../RoundContext";

export function PlayScreen() {
  const { state, startRound, call, undo, endRound } = useRound();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bombRevealed, setBombRevealed] = useState(false);
  const round = state.current;
  const canPlay = round?.status === "active";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    setInput("");
    if (!raw || !canPlay || !round) return;
    const n = Number(raw);
    if (!Number.isInteger(n)) return;
    if (n <= round.low || n >= round.high) {
      setError(`Out of range — must be between ${round.low} and ${round.high}`);
      return;
    }
    setError(null);
    call(n);
  };

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-1 text-xl font-bold">Play</h1>
      <p className="mb-6 text-white/60">Enter the number a player calls, then press Enter.</p>

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
            disabled={!round}
            className="select-none text-2xl font-bold text-[#F5C518] disabled:opacity-40"
          >
            {round && bombRevealed ? String(round.bomb).padStart(2, "0") : "••"}
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
          onClick={startRound}
          className="rounded-md bg-[#F5C518] px-3 py-1.5 font-semibold text-[#10141F]"
        >
          Start Round
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
