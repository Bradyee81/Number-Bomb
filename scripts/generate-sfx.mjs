// Synthesizes the bundled default sound effects into public/sfx/:
//   boom.wav — bomb hit (low thump + filtered noise rumble)
//   ding.wav — safe call chime, played before the range announcement
// Pure math, no samples, so there's nothing to license. Usage: npm run sfx

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  const peak = Math.max(...samples.map(Math.abs)) || 1;
  samples.forEach((s, i) => data.writeInt16LE(Math.round((s / peak) * 0.9 * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function boom(seconds = 1.6) {
  const out = new Float64Array(Math.floor(RATE * seconds));
  let lp = 0;
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    // Pitch-dropping sine thump, 110 Hz → 35 Hz.
    phase += (2 * Math.PI * (35 + 75 * Math.exp(-t * 6))) / RATE;
    const thump = Math.sin(phase) * Math.exp(-t * 3.5);
    // One-pole low-passed noise for the rumble, sharper attack at the start.
    lp += 0.06 * (noise() - lp);
    const rumble = lp * 3 * Math.exp(-t * 2.2);
    const crack = noise() * Math.exp(-t * 40) * 0.6;
    out[i] = thump + rumble + crack;
  }
  return Array.from(out);
}

function ding(seconds = 0.7) {
  const out = new Float64Array(Math.floor(RATE * seconds));
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.005);
    out[i] =
      attack *
      (Math.sin(2 * Math.PI * 1318.5 * t) * Math.exp(-t * 6) +
        0.5 * Math.sin(2 * Math.PI * 1975.5 * t) * Math.exp(-t * 9) +
        0.25 * Math.sin(2 * Math.PI * 2637 * t) * Math.exp(-t * 12));
  }
  return Array.from(out);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sfx");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "boom.wav"), toWav(boom()));
writeFileSync(join(outDir, "ding.wav"), toWav(ding()));
console.log(`Wrote boom.wav and ding.wav to ${outDir}`);
