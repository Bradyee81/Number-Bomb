interface CenterDisplayProps {
  centerVideoSrc: string;
  centerIconSrc: string;
  revealedBomb: number | null;
  size: number;
}

export function CenterDisplay({ centerVideoSrc, centerIconSrc, revealedBomb, size }: CenterDisplayProps) {
  if (revealedBomb !== null) {
    return (
      <div
        className="flex items-center justify-center font-bold text-[#F5C518]"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {String(revealedBomb).padStart(2, "0")}
      </div>
    );
  }

  if (centerVideoSrc) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={centerVideoSrc}
        autoPlay
        loop
        muted
        style={{ width: size, height: size }}
        className="object-contain"
      />
    );
  }

  return (
    <img
      src={centerIconSrc}
      alt=""
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}
