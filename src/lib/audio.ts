export function playVoiceover(n: number, volume: number): void {
  const src = `/audio/${String(n).padStart(2, "0")}.mp3`;
  const audio = new Audio(src);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {
    // Autoplay blocked or clip missing/replaced badly — voiceover is non-blocking,
    // same posture as the explosion video fallback.
  });
}
