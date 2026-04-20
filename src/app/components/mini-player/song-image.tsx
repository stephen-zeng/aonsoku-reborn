import { CachedImage } from "@/app/components/cover-image/cached-image";
import { usePlayerCurrentSong } from "@/store/player.store";

export function MiniPlayerSongImage() {
  const song = usePlayerCurrentSong();

  if (!song) return null;

  return (
    <div className="min-w-[20%] h-full max-w-full aspect-square flex items-center justify-center rounded">
      <CachedImage
        coverArtId={song.coverArt}
        coverArtType="song"
        albumId={song.albumId}
        width="100%"
        height="100%"
        loading="eager"
        className="aspect-square object-cover object-center w-full max-w-full bg-skeleton text-transparent rounded shadow-md"
        data-testid="track-image"
        alt={`${song.artist} - ${song.title}`}
      />
    </div>
  );
}
