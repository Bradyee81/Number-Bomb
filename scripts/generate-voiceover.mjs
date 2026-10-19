// Generates the Cantonese number voiceover clips public/audio/01.mp3 … 99.mp3
// using Microsoft's neural TTS voices via edge-tts (https://github.com/rany2/edge-tts).
//
// Requires uv (https://docs.astral.sh/uv/) on PATH; edge-tts is fetched on demand by uvx.
// Needs an internet connection — only the number words are sent to Microsoft.
//
// Usage:
//   npm run voiceover                         # default voice, regenerate all
//   npm run voiceover -- --voice zh-HK-HiuGaaiNeural
//   npm run voiceover -- --rate +10% --only 42
//
// Cantonese voices: zh-HK-WanLungNeural (male), zh-HK-HiuGaaiNeural, zh-HK-HiuMaanNeural (female).

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 1–99 as Chinese numerals, e.g. 10 → 十, 15 → 十五, 42 → 四十二. */
export function toChinese(n) {
  if (n < 1 || n > 99) throw new RangeError(`out of range: ${n}`);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return DIGITS[ones];
  return (tens === 1 ? "" : DIGITS[tens]) + "十" + DIGITS[ones];
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const voice = arg("voice", "zh-HK-WanLungNeural");
const rate = arg("rate", "+0%");
const only = arg("only");

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
mkdirSync(outDir, { recursive: true });

const numbers = only ? [Number(only)] : Array.from({ length: 99 }, (_, i) => i + 1);

for (const n of numbers) {
  const file = join(outDir, `${String(n).padStart(2, "0")}.mp3`);
  const text = toChinese(n);
  execFileSync(
    "uvx",
    ["edge-tts", "--voice", voice, `--rate=${rate}`, "--text", text, "--write-media", file],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  console.log(`${String(n).padStart(2, "0")}  ${text}`);
}

console.log(`Done: ${numbers.length} clip(s) in ${outDir} (voice ${voice})`);
