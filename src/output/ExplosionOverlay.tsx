import { useEffect, useRef, useState } from "react";

interface ExplosionOverlayProps {
  videoSrc: string;
  onDone: () => void;
}

const HARD_TIMEOUT_MS = 15000;

export function ExplosionOverlay({ videoSrc, onDone }: ExplosionOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    let t = setTimeout(onDone, HARD_TIMEOUT_MS);
    const onMeta = () => {
      clearTimeout(t);
      if (el && Number.isFinite(el.duration)) {
        t = setTimeout(onDone, el.duration * 1000 + 2000);
      }
    };
    el?.addEventListener("loadedmetadata", onMeta);
    return () => {
      clearTimeout(t);
      el?.removeEventListener("loadedmetadata", onMeta);
    };
  }, [onDone]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handleEnded = () => onDone();
    const handleError = () => setFallback(true);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("error", handleError);
    el.play().catch(() => setFallback(true));
    return () => {
      el.removeEventListener("ended", handleEnded);
      el.removeEventListener("error", handleError);
    };
  }, [onDone]);

  useEffect(() => {
    if (!fallback) return;
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [fallback, onDone]);

  if (fallback) {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 animate-[redFlash_0.25s_ease-in-out_4]" />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      src={videoSrc}
      autoPlay
      className="pointer-events-none fixed inset-0 z-40 h-full w-full object-cover"
    />
  );
}
