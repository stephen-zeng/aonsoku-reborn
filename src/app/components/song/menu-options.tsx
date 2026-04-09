import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { ContextMenuSeparator } from "@/app/components/ui/context-menu";
import { useOptions } from "@/app/hooks/use-options";
import { cacheManager, audioKey } from "@/service/cache";
import { ROUTES } from "@/routes/routesList";
import { useCacheMode } from "@/store/cache.store";
import { useIsAudioCached } from "@/store/cache-index.store";
import { ISong } from "@/types/responses/song";
import { AddToPlaylistSubMenu } from "./add-to-playlist";

interface SongMenuOptionsProps {
  variant: "context" | "dropdown";
  song: ISong;
  index: number;
}

export function SongMenuOptions({
  variant,
  song,
  index,
}: SongMenuOptionsProps) {
  const navigate = useNavigate();
  const {
    playNext,
    playLast,
    createNewPlaylist,
    addToPlaylist,
    removeSongFromPlaylist,
    startDownload,
    openSongInfo,
    isOnPlaylistPage,
  } = useOptions();
  const songIndexes = [index.toString()];
  const cacheMode = useCacheMode();
  const isCached = useIsAudioCached(song.id);
  const showCacheActions = cacheMode !== "none";

  return (
    <>
      <OptionsButtons.PlayNext
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          playNext([song]);
        }}
      />
      <OptionsButtons.PlayLast
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          playLast([song]);
        }}
      />
      <ContextMenuSeparator />
      <OptionsButtons.AddToPlaylistOption variant={variant}>
        <AddToPlaylistSubMenu
          type={variant}
          newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
          addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
        />
      </OptionsButtons.AddToPlaylistOption>
      {isOnPlaylistPage && (
        <OptionsButtons.RemoveFromPlaylist
          variant={variant}
          onClick={(e) => {
            e.stopPropagation();
            removeSongFromPlaylist(songIndexes);
          }}
        />
      )}
      <ContextMenuSeparator />
      {(song.artistId || song.albumId) && (
        <>
          {song.artistId && (
            <OptionsButtons.GotoArtist
              variant={variant}
              onClick={(e) => {
                e.stopPropagation();
                navigate(ROUTES.ARTIST.PAGE(song.artistId!));
              }}
            />
          )}
          {song.albumId && (
            <OptionsButtons.GotoAlbum
              variant={variant}
              onClick={(e) => {
                e.stopPropagation();
                navigate(ROUTES.ALBUM.PAGE(song.albumId));
              }}
            />
          )}
          <ContextMenuSeparator />
        </>
      )}
      <OptionsButtons.Download
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          startDownload(song.id);
        }}
      />
      {showCacheActions && (
        <>
          {isCached ? (
            <OptionsButtons.RemoveFromCache
              variant={variant}
              onClick={(e) => {
                e.stopPropagation();
                cacheManager.evictItem(audioKey(song.id));
              }}
            />
          ) : (
            <OptionsButtons.CacheSong
              variant={variant}
              onClick={(e) => {
                e.stopPropagation();
                cacheManager.cacheSong(song.id);
              }}
            />
          )}
        </>
      )}
      <ContextMenuSeparator />
      <OptionsButtons.SongInfo
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          openSongInfo(song.id);
        }}
      />
    </>
  );
}
