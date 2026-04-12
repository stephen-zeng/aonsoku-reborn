import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { isSafari } from "react-device-detect";
import { getCoverArtUrl } from "@/api/httpClient";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerCurrentSong, useSongColor } from "@/store/player.store";
import { isChromeOrFirefox } from "@/utils/browser";
import { hexToRgba } from "@/utils/getAverageColor";

export function FullscreenBackdrop() {
  const { useSongColorOnBigPlayer } = useSongColor();

  if (useSongColorOnBigPlayer) {
    return <DynamicColorBackdrop />;
  }

  return <ImageBackdrop />;
}

export function ImageBackdrop() {
  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      {isSafari ? <MacBackdrop /> : <OtherBackdrop />}
    </div>
  );
}

function OtherBackdrop() {
  const { coverArt } = usePlayerCurrentSong();
  const coverArtUrl = getCoverArtUrl(coverArt, "song", "300");
  const [backgroundImage, setBackgroundImage] = useState(coverArtUrl);
  const { bigPlayerBlur } = useSongColor();

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setBackgroundImage(coverArtUrl);
    };
    img.src = coverArtUrl;
    return () => {
      cancelled = true;
    };
  }, [coverArtUrl]);

  return (
    <div className="relative w-full h-full transition-colors duration-1000 bg-black/0">
      <div
        className="absolute -inset-10 bg-cover bg-center z-0 transition-[background-image] duration-1000 scale-125"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          filter: `blur(${bigPlayerBlur.value}px) saturate(1.5)`,
        }}
      />
      <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-black/30 via-background/70 to-background transition-colors duration-1000" />
    </div>
  );
}

function MacBackdrop() {
  const { coverArt, title } = usePlayerCurrentSong();
  const { bigPlayerBlur, currentSongColor, currentSongColorIntensity } =
    useSongColor();

  const backgroundColor = useMemo(() => {
    if (!currentSongColor) return undefined;
    return hexToRgba(currentSongColor, currentSongColorIntensity);
  }, [currentSongColor, currentSongColorIntensity]);

  return (
    <div
      className="relative w-full h-full flex items-center transition-colors duration-1000"
      style={{ backgroundColor }}
    >
      <CachedImage
        key={coverArt}
        coverArtId={coverArt}
        coverArtType="song"
        coverArtSize="300"
        alt={title}
        effect="opacity"
        width="100%"
        className="w-full bg-contain"
      />
      <div
        className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-background/70 to-background"
        style={{
          WebkitBackdropFilter: `blur(${bigPlayerBlur.value}px) saturate(1.5)`,
          backdropFilter: `blur(${bigPlayerBlur.value}px) saturate(1.5)`,
        }}
      />
    </div>
  );
}

function DynamicColorBackdrop() {
  const { currentSongColor, currentSongColorIntensity } = useSongColor();

  const backgroundColor = useMemo(() => {
    if (!currentSongColor) return undefined;
    return hexToRgba(currentSongColor, currentSongColorIntensity);
  }, [currentSongColor, currentSongColorIntensity]);

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <div
        className={clsx(
          "relative w-full h-full",
          isChromeOrFirefox && "bg-black/0",
        )}
      >
        <div
          className={clsx(
            "absolute inset-0 w-full h-full z-[1]",
            "bg-gradient-to-b from-black/30 via-background/70 to-background transition-[background-image] duration-1000",
          )}
        />
        <div
          className="absolute inset-0 w-full h-full z-0 transition-[background-color] duration-1000"
          style={{ backgroundColor }}
        />
      </div>
    </div>
  );
}
