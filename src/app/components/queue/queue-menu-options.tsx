import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { AddToPlaylistSubMenu } from "@/app/components/song/add-to-playlist";
import { ContextMenuSeparator } from "@/app/components/ui/context-menu";
import { useOptions } from "@/app/hooks/use-options";
import { cacheManager, audioKey } from "@/service/cache";
import { ROUTES } from "@/routes/routesList";
import { useIsAudioCached } from "@/store/cache-index.store";
import { useLibraryCaching } from "@/store/cache.store";
import { usePlayerActions, usePlayerStore } from "@/store/player.store";
import { type QueueTier } from "@/types/playerContext";
import { ISong } from "@/types/responses/song";

interface QueueMenuOptionsProps {
  variant: "context" | "dropdown";
  song: ISong;
  tier?: QueueTier;
}

export function QueueMenuOptions({
  variant,
  song,
  tier,
}: QueueMenuOptionsProps) {
  const navigate = useNavigate();
  const { removeSongFromQueue } = usePlayerActions();
  const { playNext, playLast, createNewPlaylist, addToPlaylist, openSongInfo } =
    useOptions();
  const isCached = useIsAudioCached(song.id);
  const libraryCaching = useLibraryCaching();
  const isUserQueueEmpty = usePlayerStore(
    (state) => state.songlist.userQueue.songs.length === 0,
  );

  return (
    <>
      <OptionsButtons.RemoveFromQueue
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          removeSongFromQueue(song.id, tier);
        }}
      />
      {(tier === "user" || tier === undefined) && (
        <>
          <ContextMenuSeparator />
          <OptionsButtons.PlayNext
            variant={variant}
            onClick={(e) => {
              e.stopPropagation();
              playNext([song]);
            }}
          />
          <OptionsButtons.PlayLast
            variant={variant}
            disabled={isUserQueueEmpty}
            onClick={(e) => {
              e.stopPropagation();
              playLast([song]);
            }}
          />
        </>
      )}
      <ContextMenuSeparator />
      <OptionsButtons.AddToPlaylistOption variant={variant}>
        <AddToPlaylistSubMenu
          type={variant}
          newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
          addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
        />
      </OptionsButtons.AddToPlaylistOption>
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
      {libraryCaching &&
        (isCached ? (
          <OptionsButtons.RemoveDownload
            variant={variant}
            onClick={(e) => {
              e.stopPropagation();
              cacheManager.evictItem(audioKey(song.id));
            }}
          />
        ) : (
          <OptionsButtons.DownloadSong
            variant={variant}
            onClick={(e) => {
              e.stopPropagation();
              cacheManager.cacheSong(song.id);
            }}
          />
        ))}
      {libraryCaching && <ContextMenuSeparator />}
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
