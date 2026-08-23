export function playVoiceover(n: number, volume: number): void {
  const src = `/audio/${String(n).padStart(2, "0")}.mp3`;
  const audio = new Audio(src);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {
    // Clip not present yet — voiceover content is a fast-follow (design §4, §7);
    // playback failures here are expected until 01.mp3…99.mp3 are added.
  });
}
