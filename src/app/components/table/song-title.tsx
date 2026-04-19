import { ArtistLink, ArtistsLinks } from "@/app/components/song/artist-link";
import { CoverImage } from "@/app/components/table/cover-image";
import { useMainDrawerState } from "@/store/player.store";
import { ISong } from "@/types/responses/song";

export function TableSongTitle({
  song,
  onPlay,
}: {
  song: ISong;
  onPlay?: () => void;
}) {
  const { mainDrawerState, closeDrawer } = useMainDrawerState();

  function handleArtistLinkClick() {
    if (mainDrawerState) closeDrawer();
  }

  return (
    <div className="flex w-full gap-2 items-center">
      <CoverImage
        coverArt={song.coverArt}
        coverArtType="song"
        albumId={song.albumId}
        altText={song.title}
      />
      <div className="flex flex-col w-full justify-center truncate">
        <span className="font-medium truncate">{song.title}</span>
        <div className="flex items-center truncate">
          <TableArtists song={song} onClickLink={handleArtistLinkClick} />
        </div>
      </div>
    </div>
  );
}

type ArtistsLinksProps = {
  song: ISong;
  onClickLink?: () => void;
};

export function TableArtists({ song, onClickLink }: ArtistsLinksProps) {
  const { artists, artistId, artist } = song;

  if (artists && artists.length > 1) {
    return (
      <ArtistsLinks
        artists={artists}
        disableNavigation={true}
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
      disableNavigation={true}
      className="text-xs text-foreground/70 text-nowrap"
      data-testid="track-artist-url"
      onClick={onClickLink}
    >
      {artist}
    </ArtistLink>
  );
}
