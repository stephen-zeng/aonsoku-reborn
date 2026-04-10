import { OptionsButtons } from "@/app/components/options/buttons";
import { AddToPlaylistSubMenu } from "@/app/components/song/add-to-playlist";
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { useOptions } from "@/app/hooks/use-options";
import { cacheManager } from "@/service/cache";
import { useCacheMode } from "@/store/cache.store";
import { SingleAlbum } from "@/types/responses/album";

interface AlbumOptionsProps {
  album: SingleAlbum;
}

export function AlbumOptions({ album }: AlbumOptionsProps) {
  const {
    playNext,
    playLast,
    startDownload,
    addToPlaylist,
    createNewPlaylist,
  } = useOptions();
  const cacheMode = useCacheMode();
  const showCacheActions = cacheMode !== "none";

  function handlePlayNext() {
    playNext(album.song, { albumId: album.id });
  }

  function handlePlayLast() {
    playLast(album.song, { albumId: album.id });
  }

  function handleDownload() {
    startDownload(album.id);
  }

  function handleAddToPlaylist(id: string) {
    const songIdToAdd = album.song.map((song) => song.id);

    addToPlaylist(id, songIdToAdd);
  }

  function handleCreateNewPlaylist() {
    const songIdToAdd = album.song.map((song) => song.id);

    createNewPlaylist(album.name, songIdToAdd);
  }

  return (
    <>
      <DropdownMenuGroup>
        <OptionsButtons.PlayNext onClick={handlePlayNext} />
        <OptionsButtons.PlayLast onClick={handlePlayLast} />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <OptionsButtons.AddToPlaylistOption variant="dropdown">
        <AddToPlaylistSubMenu
          type="dropdown"
          newPlaylistFn={handleCreateNewPlaylist}
          addToPlaylistFn={handleAddToPlaylist}
        />
      </OptionsButtons.AddToPlaylistOption>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <OptionsButtons.Download onClick={handleDownload} />
        {showCacheActions && (
          <OptionsButtons.CacheAlbum
            onClick={() => cacheManager.cacheAlbum(album.id)}
          />
        )}
      </DropdownMenuGroup>
    </>
  );
}
