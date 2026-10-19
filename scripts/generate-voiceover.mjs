// Generates the bundled voice packs public/audio/<lang>/{01…99,to,hit}.mp3
// using Microsoft's neural TTS voices via edge-tts (https://github.com/rany2/edge-tts),
// then trims the leading/trailing silence with ffmpeg so clips can be chained
// back-to-back at any playback speed (see src/lib/audio.ts).
//
// Requires uv (https://docs.astral.sh/uv/) on PATH; edge-tts and ffmpeg
// (imageio-ffmpeg) are fetched on demand by uvx. Needs an internet connection —
// only the words are sent to Microsoft.
//
// Usage:
//   npm run voiceover                          # all languages
//   npm run voiceover -- --lang yue            # one language (yue | cmn | en)
//   npm run voiceover -- --lang en --voice en-US-AndrewNeural --rate -10%
//   npm run voiceover -- --lang yue --only 42  # redo one clip (01…99, to, hit)

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ZH_DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 1–99 as Chinese numerals, e.g. 10 → 十, 15 → 十五, 42 → 四十二. */
export function toChinese(n) {
  if (n < 1 || n > 99) throw new RangeError(`out of range: ${n}`);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return ZH_DIGITS[ones];
  return (tens === 1 ? "" : ZH_DIGITS[tens]) + "十" + ZH_DIGITS[ones];
}

const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety"];

/** 1–99 in English words, e.g. 42 → forty-two. */
export function toEnglish(n) {
  if (n < 1 || n > 99) throw new RangeError(`out of range: ${n}`);
  if (n < 20) return EN_ONES[n];
  const ones = n % 10;
  return EN_TENS[Math.floor(n / 10)] + (ones ? `-${EN_ONES[ones]}` : "");
}

// Keep in sync with VOICE_LANGUAGES in src/types.ts.
const LANGUAGES = {
  yue: { voice: "zh-HK-WanLungNeural", number: toChinese, to: "至", hit: "哈哈哈，你开口中" },
  cmn: { voice: "zh-CN-YunjianNeural", number: toChinese, to: "至", hit: "哈哈哈，你中招了" },
  en: { voice: "en-US-GuyNeural", number: toEnglish, to: "to", hit: "Ha ha ha, you hit the bomb!" },
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const langs = arg("lang") ? [arg("lang")] : Object.keys(LANGUAGES);
const rate = arg("rate", "+0%");
const only = arg("only");

const ffmpeg = execFileSync(
  "uvx",
  ["--from", "imageio-ffmpeg", "python", "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
).trim();

// Strip silence from both ends: trim the start, reverse, trim again, reverse back.
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03";
const TRIM_FILTER = `${TRIM},areverse,${TRIM},areverse`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
const work = mkdtempSync(join(tmpdir(), "number-bomb-voice-"));

try {
  for (const lang of langs) {
    const cfg = LANGUAGES[lang];
    if (!cfg) throw new Error(`unknown language "${lang}" (use ${Object.keys(LANGUAGES).join(", ")})`);
    const voice = arg("voice", cfg.voice);
    const outDir = join(root, lang);
    mkdirSync(outDir, { recursive: true });

    const clips = Array.from({ length: 99 }, (_, i) => ({
      name: String(i + 1).padStart(2, "0"),
      text: cfg.number(i + 1),
    }));
    clips.push({ name: "to", text: cfg.to }, { name: "hit", text: cfg.hit });
    const selected = only ? clips.filter((c) => c.name === only.padStart(2, "0")) : clips;

    for (const { name, text } of selected) {
      const raw = join(work, `${lang}-${name}.mp3`);
      execFileSync(
        "uvx",
        ["edge-tts", "--voice", voice, `--rate=${rate}`, "--text", text, "--write-media", raw],
        { stdio: ["ignore", "ignore", "inherit"] },
      );
      execFileSync(
        ffmpeg,
        ["-y", "-loglevel", "error", "-i", raw, "-af", TRIM_FILTER, "-c:a", "libmp3lame", "-q:a", "4",
          join(outDir, `${name}.mp3`)],
        { stdio: ["ignore", "ignore", "inherit"] },
      );
      console.log(`${lang}/${name}  ${text}`);
    }
    console.log(`Done: ${selected.length} clip(s) in ${outDir} (voice ${voice})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
