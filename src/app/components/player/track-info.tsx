import randomCSSHexColor from "@chriscodesthings/random-css-hex-color";
import { AudioLines, Maximize2 } from "lucide-react";
import { useCallback } from "react";
import { Fragment } from "react/jsx-runtime";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CachedImage } from "@/app/components/cover-image/cached-image";
import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title";
import FullscreenMode from "@/app/components/fullscreen/page";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";
import { useFullscreenPlayerState, useSongColor } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { openFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { getAverageColor } from "@/utils/getAverageColor";
import { logger } from "@/utils/logger";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.crossOrigin = null;
}

export function TrackInfo({ song }: { song: ISong | undefined }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { setCurrentSongColor } = useSongColor();
  const { fullscreenPlayerOpen } = useFullscreenPlayerState();

  const getImageColor = useCallback(
    async (e: React.SyntheticEvent<HTMLImageElement>) => {
      // e.currentTarget avoids races when the cover art URL swaps.
      const img = e.currentTarget;

      let color = randomCSSHexColor(true);

      try {
        color = (await getAverageColor(img)).hex;
        logger.info("[TrackInfo] - Getting Image Average Color", {
          color,
        });
      } catch {
        logger.error("[TrackInfo] - Unable to get image average color.");
      }

      setCurrentSongColor(color);
    },
    [setCurrentSongColor],
  );

  if (!song) {
    return (
      <Fragment>
        <div className="w-12 h-12 sm:w-[70px] sm:h-[70px] flex justify-center items-center bg-muted rounded">
          <AudioLines
            data-testid="song-no-playing-icon"
            className="size-5 sm:size-6"
          />
        </div>
        <div className="flex flex-col justify-center">
          <span
            className="text-xs sm:text-sm font-medium"
            data-testid="song-no-playing-label"
          >
            {t("player.noSongPlaying")}
          </span>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div className="group relative">
        <div className="w-12 h-12 sm:w-[70px] sm:h-[70px] sm:min-w-[70px] sm:max-w-[70px] aspect-square bg-cover bg-center bg-skeleton rounded overflow-hidden shadow-md">
          <CachedImage
            key={song.id}
            id="track-song-image"
            coverArtId={song.coverArt}
            coverArtType="song"
            coverArtSize="300"
            width="100%"
            height="100%"
            crossOrigin="anonymous"
            className="aspect-square object-cover w-full h-full cursor-pointer bg-skeleton text-transparent"
            data-testid="track-image"
            alt={`${song.artist} - ${song.title}`}
            onLoad={getImageColor}
            onError={handleError}
          />
        </div>
        <FullscreenMode
          open={fullscreenPlayerOpen}
          onOpenChange={(open) => {
            if (open) openFullscreenPlayerWithHistory("playing");
          }}
        >
          <Button
            variant="secondary"
            size="icon"
            className="hidden sm:block cursor-pointer w-8 h-8 shadow-md rounded-full opacity-0 sm:group-hover:opacity-100 transition-opacity ease-in-out absolute top-1 right-1 focus-visible:opacity-100"
            data-testid="track-fullscreen-button"
          >
            <SimpleTooltip text={t("fullscreen.switchButton")} align="start">
              <div className="w-full h-full flex items-center justify-center">
                <Maximize2 className="w-4 h-4" />
              </div>
            </SimpleTooltip>
          </Button>
        </FullscreenMode>
      </div>
      <div className="flex flex-col justify-center w-full overflow-hidden ml-1">
        <MarqueeTitle gap="mr-2">
          {isMobile ? (
            <span
              className="text-xs sm:text-sm font-medium"
              data-testid="track-title"
            >
              {song.title}
            </span>
          ) : (
            <Link to={ROUTES.ALBUM.PAGE(song.albumId)} tabIndex={-1}>
              <span
                className="text-xs sm:text-sm font-medium hover:underline cursor-pointer"
                data-testid="track-title"
              >
                {song.title}
              </span>
            </Link>
          )}
        </MarqueeTitle>
        <TrackInfoArtistsLinks disableNavigation={isMobile} song={song} />
      </div>
    </Fragment>
  );
}

type TrackInfoArtistsLinksProps = {
  song: ISong;
  disableNavigation?: boolean;
};

function TrackInfoArtistsLinks({
  song,
  disableNavigation = false,
}: TrackInfoArtistsLinksProps) {
  const { artists, artistId, artist } = song;

  if (artists && artists.length > 1) {
    const reducedArtists = artists.slice(0, ALBUM_ARTISTS_MAX_NUMBER);

    return (
      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground w-full maskImage-marquee-fade-finished">
        {reducedArtists.map(({ id, name }, index) => (
          <div key={id} className="flex items-center">
            <ArtistLink
              disableNavigation={disableNavigation}
              id={id}
              name={name}
            />
            {index < reducedArtists.length - 1 && ","}
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
    />
  );
}

type ArtistLinkProps = {
  id?: string;
  name: string;
  disableNavigation?: boolean;
};

function ArtistLink({ id, name, disableNavigation = false }: ArtistLinkProps) {
  if (disableNavigation || !id) {
    return (
      <span
        className="w-fit inline-flex text-[10px] sm:text-xs text-muted-foreground text-nowrap"
        data-testid="track-artist-url"
      >
        {name}
      </span>
    );
  }

  return (
    <Link
      to={ROUTES.ARTIST.PAGE(id)}
      className="w-fit inline-flex"
      data-testid="track-artist-url"
    >
      <span
        className={cn(
          "text-[10px] sm:text-xs text-muted-foreground text-nowrap",
          "hover:underline hover:text-foreground",
        )}
      >
        {name}
      </span>
    </Link>
  );
}
