// Voiceover clips live in /audio: 01.mp3…99.mp3 plus to.mp3 ("至")
// and hit.mp3 ("哈哈哈，你开口中").
// Announcements are stitched from several clips, so each clip's TTS silence
// padding is trimmed off and the pieces are scheduled back-to-back.

const SILENCE_THRESHOLD = 0.01;
const EDGE_PAD_SEC = 0.03;
const GAP_SEC = 0.06;

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let playing: AudioBufferSourceNode[] = [];
let playToken = 0;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function clipName(n: number): string {
  return String(n).padStart(2, "0");
}

function trimSilence(ac: AudioContext, buf: AudioBuffer): AudioBuffer {
  const data = buf.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]) < SILENCE_THRESHOLD) start++;
  while (end > start && Math.abs(data[end]) < SILENCE_THRESHOLD) end--;
  const pad = Math.floor(EDGE_PAD_SEC * buf.sampleRate);
  start = Math.max(0, start - pad);
  end = Math.min(data.length - 1, end + pad);

  const out = ac.createBuffer(buf.numberOfChannels, end - start + 1, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(start, end + 1), ch);
  }
  return out;
}

function loadClip(name: string): Promise<AudioBuffer> {
  let p = buffers.get(name);
  if (!p) {
    const ac = getContext();
    p = fetch(`/audio/${name}.mp3`)
      .then((r) => {
        if (!r.ok) throw new Error(`missing clip ${name}`);
        return r.arrayBuffer();
      })
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => trimSilence(ac, buf));
    // Don't cache failures, so a clip dropped in later can still load.
    p.catch(() => buffers.delete(name));
    buffers.set(name, p);
  }
  return p;
}

async function playSequence(names: string[], volume: number): Promise<void> {
  const token = ++playToken;
  const ac = getContext();
  const clips = await Promise.all(names.map(loadClip));
  if (token !== playToken) return; // a newer call superseded this one
  if (ac.state === "suspended") await ac.resume();

  playing.forEach((s) => s.stop());
  const gain = ac.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  gain.connect(ac.destination);

  let at = ac.currentTime + 0.02;
  playing = clips.map((buf) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(at);
    at += buf.duration + GAP_SEC;
    return src;
  });
}

function playSafely(names: string[], volume: number): void {
  playSequence(names, volume).catch(() => {
    // Autoplay blocked or a clip missing — voiceover is non-blocking,
    // same posture as the explosion video fallback.
  });
}

/** Reads the bomb number on a hit, then "哈哈哈，你开口中". */
export function playBombHit(n: number, volume: number): void {
  playSafely([clipName(n), "hit"], volume);
}

/** Reads the new range after a call, e.g. "十二 至 九十九". */
export function playRangeAnnouncement(low: number, high: number, volume: number): void {
  playSafely([clipName(low), "to", clipName(high)], volume);
}
