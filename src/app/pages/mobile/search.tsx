import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/app/components/ui/input";
import { useSongList } from "@/app/hooks/use-song-list";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { byteLength } from "@/utils/byteLength";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";
import Image from "@/app/components/image";
import { Button } from "@/app/components/ui/button";
import { Play } from "lucide-react";
import { ISimilarArtist } from "@/types/responses/artist";
import { Albums } from "@/types/responses/album";
import { ISong } from "@/types/responses/song";
import { CoverArt } from "@/types/coverArtType";
import { Link } from "react-router-dom";
import { getCoverArtUrl } from "@/api/httpClient";

interface MobileResultItemProps {
  coverArt: string;
  coverArtType: CoverArt;
  title: string;
  subtitle: string;
  onRowClick: () => void;
  onPlayClick: () => void;
}

function MobileResultItem({
  coverArt,
  coverArtType,
  title,
  subtitle,
  onRowClick,
  onPlayClick,
}: MobileResultItemProps) {
  const src = getCoverArtUrl(coverArt, coverArtType, "100");

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-2 active:bg-accent/50 transition-colors text-left"
      onClick={onRowClick}
    >
      <Image
        src={src}
        width={44}
        height={44}
        className="aspect-square object-cover rounded shadow flex-shrink-0"
        alt={`${subtitle} - ${title}`}
      />
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="font-medium text-sm truncate">{title}</span>
        <span className="text-xs text-muted-foreground truncate">
          {subtitle}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-8 h-8 p-0 rounded-full flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onPlayClick();
        }}
      >
        <Play className="w-4 h-4 fill-foreground" />
      </Button>
    </button>
  );
}

interface SectionProps {
  title: string;
  seeMoreHref?: string;
  children: React.ReactNode;
}

function ResultSection({ title, seeMoreHref, children }: SectionProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        {seeMoreHref && (
          <Link
            to={seeMoreHref}
            className="text-xs text-primary underline-offset-1 hover:underline"
          >
            {t("generic.seeMore")}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function MobileSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { playSong, setSongList } = usePlayerActions();
  const { getAlbumSongs, getArtistAllSongs } = useSongList();

  const enableQuery = byteLength(query) >= 3;

  const { data: searchResult } = useQuery({
    queryKey: [queryKeys.search, query],
    queryFn: () =>
      subsonic.search.get({
        query,
        albumCount: 6,
        artistCount: 6,
        songCount: 6,
      }),
    enabled: enableQuery,
    staleTime: convertMinutesToMs(5),
  });

  const albums: Albums[] = searchResult?.album ?? [];
  const artists: ISimilarArtist[] = searchResult?.artist ?? [];
  const songs: ISong[] = searchResult?.song ?? [];

  const hasResults =
    albums.length > 0 || artists.length > 0 || songs.length > 0;
  const showNoResults = enableQuery && !hasResults;

  const debounced = useDebouncedCallback((value: string) => {
    setQuery(value);
  }, 500);

  async function handlePlayAlbum(albumId: string) {
    const albumSongs = await getAlbumSongs(albumId);
    if (albumSongs) setSongList(albumSongs, 0);
  }

  async function handlePlayArtist(artist: ISimilarArtist) {
    const artistSongs = await getArtistAllSongs(artist.id);
    if (artistSongs) setSongList(artistSongs, 0);
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            autoFocus
            placeholder={t("command.inputPlaceholder")}
            className="pl-9"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => debounced(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showNoResults && (
          <div className="flex justify-center items-center p-8">
            <p className="text-sm text-muted-foreground">
              {t("command.noResults")}
            </p>
          </div>
        )}

        {albums.length > 0 && (
          <ResultSection
            title={t("sidebar.albums")}
            seeMoreHref={ROUTES.ALBUMS.SEARCH(query)}
          >
            {albums.map((album) => (
              <MobileResultItem
                key={album.id}
                coverArt={album.coverArt}
                coverArtType="album"
                title={album.name}
                subtitle={album.artist}
                onRowClick={() => navigate(ROUTES.ALBUM.PAGE(album.id))}
                onPlayClick={() => handlePlayAlbum(album.id)}
              />
            ))}
          </ResultSection>
        )}

        {songs.length > 0 && (
          <ResultSection
            title={t("sidebar.songs")}
            seeMoreHref={ROUTES.SONGS.SEARCH(query)}
          >
            {songs.map((song) => (
              <MobileResultItem
                key={song.id}
                coverArt={song.coverArt}
                coverArtType="song"
                title={song.title}
                subtitle={song.artist}
                onRowClick={() => navigate(ROUTES.ALBUM.PAGE(song.albumId))}
                onPlayClick={() => playSong(song)}
              />
            ))}
          </ResultSection>
        )}

        {artists.length > 0 && (
          <ResultSection title={t("sidebar.artists")}>
            {artists.map((artist) => (
              <MobileResultItem
                key={artist.id}
                coverArt={artist.coverArt}
                coverArtType="artist"
                title={artist.name}
                subtitle={t("artist.info.albumsCount", {
                  count: artist.albumCount,
                })}
                onRowClick={() => navigate(ROUTES.ARTIST.PAGE(artist.id))}
                onPlayClick={() => handlePlayArtist(artist)}
              />
            ))}
          </ResultSection>
        )}
      </div>
    </div>
  );
}
