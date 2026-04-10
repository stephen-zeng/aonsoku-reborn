import { OptionsButtons } from "@/app/components/options/buttons";
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { useOptions } from "@/app/hooks/use-options";
import { useSongList } from "@/app/hooks/use-song-list";
import { cacheManager } from "@/service/cache";
import { useCacheMode } from "@/store/cache.store";
import { IArtist } from "@/types/responses/artist";
import { ISong } from "@/types/responses/song";

interface ArtistOptionsProps {
  artist: IArtist;
}

export function ArtistOptions({ artist }: ArtistOptionsProps) {
  const { getArtistAllSongs } = useSongList();
  const { playLast, playNext, startDownload } = useOptions();
  const cacheMode = useCacheMode();
  const showCacheActions = cacheMode !== "none";

  async function getSongsToQueue(callback: (songs: ISong[]) => void) {
    const songs = await getArtistAllSongs(artist.id);
    if (!songs) return;

    callback(songs);
  }

  async function handlePlayNext() {
    await getSongsToQueue(playNext);
  }

  async function handlePlayLast() {
    await getSongsToQueue(playLast);
  }

  function handleDownload() {
    startDownload(artist.id);
  }

  return (
    <>
      <DropdownMenuGroup>
        <OptionsButtons.PlayNext onClick={handlePlayNext} />
        <OptionsButtons.PlayLast onClick={handlePlayLast} />
        <DropdownMenuSeparator />
        <OptionsButtons.Download onClick={handleDownload} />
        {showCacheActions && (
          <OptionsButtons.CacheArtist
            onClick={() =>
              cacheManager.cacheArtist(artist.id)
            }
          />
        )}
      </DropdownMenuGroup>
    </>
  );
}
