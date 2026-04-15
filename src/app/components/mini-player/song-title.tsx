import { ComponentPropsWithoutRef } from "react";
import { useNavigate } from "react-router-dom";
import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";
import { usePlayerCurrentSong } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

export function MiniPlayerSongTitle() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const song = usePlayerCurrentSong();
  const enableTitleNavigation = !isMobile && Boolean(song.albumId);

  function handleTitleClick() {
    if (!enableTitleNavigation) return;

    navigate(ROUTES.ALBUM.PAGE(song.albumId));
  }

  return (
    <div className="flex flex-col flex-1 justify-center max-w-full overflow-hidden">
      <MarqueeTitle gap="mr-2">
        <span
          className={cn(
            "text-base font-medium",
            "mid-player:text-sm mini-player:text-xs mini-player:font-normal",
            enableTitleNavigation && "hover:underline cursor-pointer",
          )}
          data-testid="track-title"
          onClick={enableTitleNavigation ? handleTitleClick : undefined}
        >
          {song.title}
        </span>
      </MarqueeTitle>
      <ArtistsLinks disableNavigation={isMobile} song={song} />
    </div>
  );
}

function ArtistsLinks({
  song,
  disableNavigation,
}: {
  song: ISong;
  disableNavigation: boolean;
}) {
  const { artistId, artist, artists } = song;
  const navigate = useNavigate();

  function handleArtistClick(id?: string) {
    if (!id) return;

    navigate(ROUTES.ARTIST.PAGE(id));
  }

  if (artists && artists.length > 1) {
    const data = artists.slice(0, ALBUM_ARTISTS_MAX_NUMBER);

    return (
      <div className="flex items-center gap-1 text-xs mini-player:text-[11px] maskImage-marquee-fade-finished">
        {data.map(({ id, name }, index) => (
          <div key={id} className="flex items-center">
            <ArtistLink
              disableNavigation={disableNavigation}
              id={id}
              name={name}
              onClick={
                disableNavigation ? undefined : () => handleArtistClick(id)
              }
            />
            {index < data.length - 1 && ","}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ArtistLink
      disableNavigation={disableNavigation}
      id={artistId}
      name={artist}
      onClick={
        disableNavigation ? undefined : () => handleArtistClick(artistId)
      }
    />
  );
}

type ArtistLinkProps = ComponentPropsWithoutRef<"span"> & {
  id?: string;
  name: string;
  disableNavigation?: boolean;
};

function ArtistLink({
  id,
  name,
  className,
  disableNavigation = false,
  ...props
}: ArtistLinkProps) {
  return (
    <span
      className={cn(
        "w-fit max-w-full truncate text-xs font-normal text-foreground/70",
        "mini-player:text-[11px] mini-player:font-light",
        className,
        id &&
          !disableNavigation &&
          "hover:underline hover:text-foreground cursor-pointer",
      )}
      {...props}
    >
      {name}
    </span>
  );
}
