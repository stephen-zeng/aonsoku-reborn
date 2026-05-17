import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title";
import { cn } from "@/lib/utils";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";
import { useMiniPlayerContext } from "./context";
import { MiniPlayerProgress } from "./progress";

export function MiniPlayerSongTitle() {
  const { state } = useMiniPlayerContext();

  if (!state || !state.currentSong) return null;

  const { currentSong: song, currentLine } = state;
  const isShowingLyrics = currentLine !== null;

  const displayTitle = isShowingLyrics ? currentLine : song.title;
  const displaySubtitle = isShowingLyrics
    ? getSongAndArtistText(song)
    : getArtistsText(song);

  return (
    <div className="flex flex-col flex-1 justify-center max-w-full overflow-hidden">
      <MarqueeTitle gap="mr-2">
        <span
          className={cn(
            "text-base font-medium",
            "mid-player:text-mid-player-title mini-player:text-mini-player-title",
          )}
          data-testid="track-title"
        >
          {displayTitle}
        </span>
      </MarqueeTitle>
      <div
        className={cn(
          "flex items-center gap-1 w-full",
          "text-xs font-normal text-foreground/70",
          "mid-player:text-mid-player-subtitle",
          "mini-player:text-[11px] mini-player:font-normal",
          "mini-player:group-hover-supported:hidden",
        )}
      >
        <MarqueeTitle gap="mr-2">
          <span className="w-fit max-w-full truncate">{displaySubtitle}</span>
        </MarqueeTitle>
      </div>
      <div className="hidden mini-player:group-hover-supported:flex w-full items-center h-4">
        <MiniPlayerProgress showTime compact />
      </div>
    </div>
  );
}

function getArtistsText(song: { artist: string; artists?: { name: string }[] }): string {
  if (song.artists && song.artists.length > 0) {
    return song.artists
      .slice(0, ALBUM_ARTISTS_MAX_NUMBER)
      .map((a) => a.name)
      .join(", ");
  }
  return song.artist;
}

function getSongAndArtistText(song: { title: string; artist: string; artists?: { name: string }[] }): string {
  return `${song.title} · ${getArtistsText(song)}`;
}
