import { ArtistLink, ArtistsLinks } from "@/app/components/song/artist-link";
import { CoverImage } from "@/app/components/table/cover-image";
import { cn } from "@/lib/utils";
import { useMainDrawerState } from "@/store/player.store";
import { ISong } from "@/types/responses/song";

export function TableSongTitle({
  song,
  onPlay,
  disableTextNavigation = false,
}: {
  song: ISong;
  onPlay?: () => void;
  disableTextNavigation?: boolean;
}) {
  const { mainDrawerState, closeDrawer } = useMainDrawerState();

  function handleArtistLinkClick() {
    if (mainDrawerState) closeDrawer();
  }

  return (
    <div
      className={cn("flex w-full gap-2 items-center", disableTextNavigation && "opacity-50")}
    >
      <CoverImage
        coverArt={song.coverArt}
        coverArtType="song"
        albumId={song.albumId}
        altText={song.title}
      />
      <div className="flex flex-col w-full justify-center truncate">
        <span
          className={cn(
            "font-medium truncate",
            onPlay &&
              !disableTextNavigation &&
              "cursor-pointer hover:underline",
            disableTextNavigation && "text-muted-foreground",
          )}
          onClick={
            onPlay && !disableTextNavigation
              ? (e) => {
                  e.stopPropagation();
                  onPlay();
                }
              : undefined
          }
          onTouchEnd={undefined}
        >
          {song.title}
        </span>
        <div className="flex items-center truncate">
          <TableArtists
            song={song}
            disableTextNavigation={disableTextNavigation}
            onClickLink={handleArtistLinkClick}
          />
        </div>
      </div>
    </div>
  );
}

type ArtistsLinksProps = {
  song: ISong;
  disableTextNavigation?: boolean;
  onClickLink?: () => void;
};

export function TableArtists({
  song,
  disableTextNavigation = false,
  onClickLink,
}: ArtistsLinksProps) {
  const { artists, artistId, artist } = song;

  if (artists && artists.length > 1) {
    return (
      <ArtistsLinks
        artists={artists}
        disableNavigation={disableTextNavigation}
        onClickLink={onClickLink}
        className="w-full gap-1 text-xs text-foreground/70 maskImage-marquee-fade-finished"
        linkClassName="text-xs text-foreground/70 text-nowrap"
        linkTestId="track-artist-url"
      />
    );
  }

  if (!artistId) {
    return (
      <span className="text-xs text-foreground/70 text-nowrap">{artist}</span>
    );
  }

  return (
    <ArtistLink
      artistId={artistId}
      disableNavigation={disableTextNavigation}
      className="text-xs text-foreground/70 text-nowrap"
      data-testid="track-artist-url"
      onClick={onClickLink}
    >
      {artist}
    </ArtistLink>
  );
}
