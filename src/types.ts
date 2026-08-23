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

export interface Settings {
  chroma_color: string;
  explosion_video_path: string;
  voiceover_volume: number;
  center_video_path: string;
  center_icon_path: string;
  digit_strip_path: string;
  bomb_font_family: string;
  bomb_font_size_px: number;
  custom_font_path: string;
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
  custom_font_path: "",
};

export const DEFAULT_DIGIT_STRIP = "/assets/digit-strip-default.svg";
export const DIGIT_CELL_HEIGHT = 300;
export const DIGIT_CELL_WIDTH = 200;
