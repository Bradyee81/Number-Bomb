import { useEffect, useState } from "react";

interface CenterDisplayProps {
  centerVideoSrc: string;
  centerIconSrc: string;
  revealedBomb: number | null;
  size: number;
  bombFontFamily: string;
  bombFontSizePx: number;
  bombColor: string;
  /** Outline color, or null for no outline. */
  bombOutlineColor: string | null;
}

const DEFAULT_ICON_SRC = "/media/center-icon-default.png";

export function CenterDisplay({
  centerVideoSrc,
  centerIconSrc,
  revealedBomb,
  size,
  bombFontFamily,
  bombFontSizePx,
  bombColor,
  bombOutlineColor,
}: CenterDisplayProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [centerVideoSrc]);

  useEffect(() => {
    setIconFailed(false);
  }, [centerIconSrc]);

  if (revealedBomb !== null) {
    return (
      <div
        className="flex items-center justify-center font-bold"
        style={{
          width: size,
          height: size,
          fontSize: bombFontSizePx,
          fontFamily: bombFontFamily,
          color: bombColor,
          // Stroke is drawn under the fill (paint-order), so only its outer half shows.
          ...(bombOutlineColor && {
            WebkitTextStroke: `${Math.max(2, bombFontSizePx * 0.06)}px ${bombOutlineColor}`,
            paintOrder: "stroke fill",
          }),
        }}
      >
        {String(revealedBomb).padStart(2, "0")}
      </div>
    );
  }

  if (centerVideoSrc && !videoFailed) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={centerVideoSrc}
        autoPlay
        loop
        muted
        onError={() => setVideoFailed(true)}
        style={{ width: size, height: size }}
        className="object-contain"
      />
    );
  }

  return (
    <img
      src={iconFailed ? DEFAULT_ICON_SRC : centerIconSrc}
      onError={() => setIconFailed(true)}
      alt=""
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}
