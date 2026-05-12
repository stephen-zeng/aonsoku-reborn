import clsx from "clsx";
import { Play } from "lucide-react";
import { isFirefox } from "react-device-detect";
import { Link } from "react-router-dom";
import {
  CachedImage,
  useCachedCoverUrl,
} from "@/app/components/cover-image/cached-image";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";
import { useSongCoverArtUrl } from "@/utils/coverArt";

export function HeaderItem({ song }: { song: ISong }) {
  const isMobile = useIsMobile();
  const { setSongList } = usePlayerActions();
  const coverArtFallback = useSongCoverArtUrl(song, "300");
  const coverArtUrl = useCachedCoverUrl(
    song.coverArt,
    "song",
    song.albumId,
    coverArtFallback,
  );

  async function handlePlaySongAlbum(song: ISong) {
    const album = await subsonic.albums.getOne(song.albumId);

    if (album) {
      const songIndex = album.song.findIndex((item) => item.id === song.id);

      setSongList(
        album.song,
        songIndex,
        false,
        {
          albumId: album.id,
        },
        album.name,
      );
    }
  }

  return (
    <div
      className={clsx(
        "w-full h-[140px] sm:h-[250px] 2xl:h-[300px] relative",
        isFirefox && "bg-black/60",
      )}
    >
      <div
        data-testid="header-bg"
        className="absolute -inset-10 bg-cover bg-center z-0 bg-skeleton"
        style={{
          backgroundImage: `url(${coverArtUrl})`,
          filter: isFirefox ? "blur(24px)" : undefined,
        }}
      />
      <div
        className={clsx(
          "w-full h-full bg-gradient-to-b from-background/40 to-background/80 absolute z-10",
          !isFirefox && "backdrop-blur-xl",
        )}
      >
        <div className="flex h-full p-4 2xl:p-6 gap-4">
          <div
            className="h-full aspect-square relative group bg-skeleton rounded-lg"
            data-testid="header-image-container"
          >
            <CachedImage
              coverArtId={song.coverArt}
              coverArtType="song"
              albumId={song.albumId}
              alt={song.title}
              effect="opacity"
              width="100%"
              height="100%"
              className="aspect-square rounded-lg object-cover bg-center absolute inset-0 z-0"
              data-testid="header-image"
            />
            <div className="hidden sm:flex w-full h-full items-center justify-center rounded-lg bg-black bg-opacity-0 group-hover-supported:bg-opacity-50 absolute inset-0 z-10">
              <Button
                className="opacity-0 group-hover-supported:opacity-100 rounded-full w-14 h-14"
                variant="outline"
                onClick={() => handlePlaySongAlbum(song)}
                data-testid="header-play-button"
              >
                <Play className="fill-foreground" />
              </Button>
            </div>
          </div>
          <div className="flex flex-1 h-full flex-col justify-end">
            {isMobile ? (
              <h1
                data-testid="header-title"
                className="w-full scroll-m-20 text-xl sm:text-3xl 2xl:text-4xl font-bold tracking-tight mb-0 2xl:mb-1 line-clamp-2"
              >
                {song.title}
              </h1>
            ) : (
              <Link to={ROUTES.ALBUM.PAGE(song.albumId)} className="w-fit">
                <h1
                  data-testid="header-title"
                  className="w-full scroll-m-20 text-xl sm:text-3xl 2xl:text-4xl font-bold tracking-tight mb-0 2xl:mb-1 hover-supported:underline line-clamp-2"
                >
                  {song.title}
                </h1>
              </Link>
            )}
            {!song.artistId ? (
              <h4
                data-testid="header-artist"
                className="scroll-m-20 text-base sm:text-lg 2xl:text-xl font-semibold tracking-tight opacity-70"
              >
                {song.artist}
              </h4>
            ) : isMobile ? (
              <h4
                data-testid="header-artist"
                className="scroll-m-20 text-base sm:text-lg 2xl:text-xl font-semibold tracking-tight opacity-70"
              >
                {song.artist}
              </h4>
            ) : (
              <Link to={ROUTES.ARTIST.PAGE(song.artistId)} className="w-fit">
                <h4
                  data-testid="header-artist"
                  className="scroll-m-20 text-base sm:text-lg 2xl:text-xl font-semibold tracking-tight opacity-70 hover-supported:underline"
                >
                  {song.artist}
                </h4>
              </Link>
            )}
            <div className="hidden sm:flex gap-2 mt-1 2xl:mt-2">
              {song.genre !== undefined && (
                <Link to={ROUTES.ALBUMS.GENRE(song.genre)} className="flex">
                  <Badge
                    variant="neutral"
                    className="border"
                    data-testid="header-genre"
                  >
                    {song.genre}
                  </Badge>
                </Link>
              )}
              {song.year && (
                <Badge
                  variant="neutral"
                  className="border"
                  data-testid="header-year"
                >
                  {song.year}
                </Badge>
              )}
              <Badge
                variant="neutral"
                className="border"
                data-testid="header-duration"
              >
                {convertSecondsToTime(song.duration)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
