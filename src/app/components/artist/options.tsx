import { OptionsButtons } from "@/app/components/options/buttons";
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { useOptions } from "@/app/hooks/use-options";
import { useSongList } from "@/app/hooks/use-song-list";
import { cacheManager } from "@/service/cache";
import { usePlayerStore } from "@/store/player.store";
import { IArtist } from "@/types/responses/artist";
import { ISong } from "@/types/responses/song";

interface ArtistOptionsProps {
  artist: IArtist;
}

export function ArtistOptions({ artist }: ArtistOptionsProps) {
  const { getArtistAllSongs } = useSongList();
  const { playLast, playNext, startDownload } = useOptions();
  const isUserQueueEmpty = usePlayerStore(
    (state) => state.songlist.userQueue.songs.length === 0,
  );

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
        <OptionsButtons.PlayLast
          onClick={handlePlayLast}
          disabled={isUserQueueEmpty}
        />
        <DropdownMenuSeparator />
        <OptionsButtons.SaveFile onClick={handleDownload} />
        <OptionsButtons.DownloadArtist
          onClick={() => cacheManager.cacheArtist(artist.id)}
        />
      </DropdownMenuGroup>
    </>
  );
}
