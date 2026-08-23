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

export interface Settings {
  chroma_color: string;
  explosion_video_path: string;
  voiceover_volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  chroma_color: CHROMA_PRESETS[0].hex,
  explosion_video_path: "",
  voiceover_volume: 1,
};

export const DEFAULT_DIGIT_STRIP = "/assets/digit-strip-default.svg";
export const DIGIT_CELL_HEIGHT = 300;
export const DIGIT_CELL_WIDTH = 200;
