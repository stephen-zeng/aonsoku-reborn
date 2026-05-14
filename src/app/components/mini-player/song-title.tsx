import { useNavigate } from "react-router-dom";
import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title";
import { useCurrentLyricLine } from "@/app/hooks/use-current-lyric-line";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";
import { usePlayerCurrentSong } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";
import { MiniPlayerProgress } from "./progress";

export function MiniPlayerSongTitle() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const song = usePlayerCurrentSong();
  const { currentLine } = useCurrentLyricLine();

  if (!song) return null;

  const enableTitleNavigation = !isMobile && Boolean(song.albumId);
  const isShowingLyrics = currentLine !== null;

  function handleTitleClick() {
    if (!enableTitleNavigation) return;

    navigate(ROUTES.ALBUM.PAGE(song.albumId));
  }

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
            "mid-player:text-sm mini-player:text-xs mini-player:font-normal",
            !isShowingLyrics &&
              enableTitleNavigation &&
              "hover-supported:underline cursor-pointer",
          )}
          data-testid="track-title"
          onClick={
            !isShowingLyrics && enableTitleNavigation
              ? handleTitleClick
              : undefined
          }
        >
          {displayTitle}
        </span>
      </MarqueeTitle>
      <div
        className={cn(
          "flex items-center gap-1 w-full",
          "text-xs font-normal text-foreground/70",
          "mini-player:text-[11px] mini-player:font-light",
          "mini-player:group-hover-supported:hidden",
        )}
      >
        <MarqueeTitle gap="mr-2">
          <span
            className={cn(
              "w-fit max-w-full truncate",
              isShowingLyrics &&
                enableTitleNavigation &&
                "hover-supported:underline cursor-pointer",
            )}
            onClick={
              isShowingLyrics && enableTitleNavigation
                ? handleTitleClick
                : undefined
            }
          >
            {displaySubtitle}
          </span>
        </MarqueeTitle>
      </div>
      <div className="hidden mini-player:group-hover-supported:block w-full">
        <MiniPlayerProgress showTime={false} />
      </div>
    </div>
  );
}

function getArtistsText(song: ISong): string {
  if (song.artists && song.artists.length > 0) {
    return song.artists
      .slice(0, ALBUM_ARTISTS_MAX_NUMBER)
      .map((a) => a.name)
      .join(", ");
  }
  return song.artist;
}

function getSongAndArtistText(song: ISong): string {
  return `${song.title} · ${getArtistsText(song)}`;
}
