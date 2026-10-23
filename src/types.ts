export interface ChromaPreset {
  name: string;
  hex: string;
}

export const CHROMA_PRESETS: ChromaPreset[] = [
  { name: "Pure Green", hex: "#00FF00" },
  { name: "Broadcast Green", hex: "#00B140" },
  { name: "Chroma Green", hex: "#00FF66" },
  { name: "Deep Green", hex: "#009A44" },
  { name: "Pure Blue", hex: "#0000FF" },
  { name: "Broadcast Blue", hex: "#0047AB" },
  { name: "Sky Blue", hex: "#0AB4E0" },
  { name: "Royal Blue", hex: "#1E3A8A" },
];

export interface FontPreset {
  name: string;
  family: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { name: "Segoe UI (Default)", family: "'Segoe UI', system-ui, -apple-system, sans-serif" },
  { name: "Impact", family: "Impact, 'Arial Black', sans-serif" },
  { name: "Arial Black", family: "'Arial Black', Arial, sans-serif" },
  { name: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { name: "Courier New", family: "'Courier New', Courier, monospace" },
];

export const CUSTOM_FONT_FAMILY_NAME = "NumberBombCustomFont";

export const BOMB_COLOR_PRESETS: ChromaPreset[] = [
  { name: "Gold", hex: "#F5C518" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#FF2D2D" },
  { name: "Orange", hex: "#FF8A00" },
  { name: "Black", hex: "#000000" },
];

/** True when two hex colors are close enough that a chroma key would remove one with the other. */
export function colorsClash(a: string, b: string): boolean {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 140;
}

// Bundled voice packs in public/audio/<id>/ — keep in sync with
// LANGUAGES in scripts/generate-voiceover.mjs.
export const VOICE_LANGUAGES = [
  { id: "yue", name: "Cantonese 粵語" },
  { id: "cmn", name: "Mandarin 普通话" },
  { id: "en", name: "English" },
] as const;

export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number]["id"];

export const DEFAULT_HIT_SFX = "/sfx/boom.wav";
export const DEFAULT_CALL_SFX = "/sfx/ding.wav";

export interface Settings {
  chroma_color: string;
  explosion_video_path: string;
  voiceover_volume: number;
  center_video_path: string;
  center_icon_path: string;
  digit_strip_path: string;
  bomb_font_family: string;
  bomb_font_size_px: number;
  bomb_font_color: string;
  bomb_outline_enabled: boolean;
  bomb_outline_color: string;
  custom_font_path: string;
  explosion_enabled: boolean;
  voice_language: VoiceLanguage;
  /** Voiceover playback rate, pitch preserved. */
  voice_speed: number;
  /** Multiplier on the reel/center size, relative to a 1920×1080 layout. */
  output_scale: number;
  sfx_volume: number;
  hit_sfx_enabled: boolean;
  hit_sfx_path: string;
  call_sfx_enabled: boolean;
  call_sfx_path: string;
  /** On a bomb hit, read out the bomb number. */
  hit_number_enabled: boolean;
  /** On a bomb hit, play the hit line ("哈哈哈，你开口中" or a custom upload). */
  hit_line_enabled: boolean;
  hit_line_path: string;
  /** Image or video shown behind the reels instead of the plain chroma color. */
  background_path: string;
  /** OS name of the display the Output window presents on ("" = auto). */
  output_screen: string;
}

export const VIDEO_EXTENSIONS = ["mp4", "webm"];

export function isVideoPath(path: string): boolean {
  return VIDEO_EXTENSIONS.includes(path.split(".").pop()?.toLowerCase() ?? "");
}

export const DEFAULT_SETTINGS: Settings = {
  chroma_color: CHROMA_PRESETS[0].hex,
  explosion_video_path: "",
  voiceover_volume: 1,
  center_video_path: "",
  center_icon_path: "",
  digit_strip_path: "",
  bomb_font_family: FONT_PRESETS[0].family,
  bomb_font_size_px: 260,
  bomb_font_color: "#F5C518",
  bomb_outline_enabled: false,
  bomb_outline_color: "#000000",
  custom_font_path: "",
  explosion_enabled: true,
  voice_language: "yue",
  voice_speed: 0.9,
  output_scale: 1,
  sfx_volume: 0.8,
  hit_sfx_enabled: true,
  hit_sfx_path: "",
  call_sfx_enabled: true,
  call_sfx_path: "",
  hit_number_enabled: true,
  hit_line_enabled: true,
  hit_line_path: "",
  background_path: "",
  output_screen: "",
};

export const DEFAULT_DIGIT_STRIP = "/assets/digit-strip-default.svg";
export const DIGIT_CELL_HEIGHT = 300;
export const DIGIT_CELL_WIDTH = 200;
