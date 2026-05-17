import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { ContextMenuSeparator } from "@/app/components/ui/context-menu";
import { useOptions } from "@/app/hooks/use-options";
import { useSongStarMutation } from "@/app/hooks/use-song-star-mutation";
import { ROUTES } from "@/routes/routesList";
import { audioKey, cacheManager } from "@/service/cache";
import { useLibraryCaching } from "@/store/cache.store";
import { useIsAudioCached } from "@/store/cache-index.store";
import {
  usePlayerCurrentSong,
  usePlayerSongStarred,
  usePlayerStore,
} from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { AddToPlaylistSubMenu } from "./add-to-playlist";

interface MenuLikeButtonProps {
  variant: "context" | "dropdown";
  song: ISong;
}

function MenuLikeButton({ variant, song }: MenuLikeButtonProps) {
  const { isStarred, setIsStarred, toggleStar } = useSongStarMutation({
    songId: song.id,
    initialStarred: typeof song.starred === "string",
    albumId: song.albumId,
    song,
  });

  const currentSong = usePlayerCurrentSong();
  const isSongStarred = usePlayerSongStarred();

  useEffect(() => {
    if (currentSong?.id === song.id) {
      setIsStarred(isSongStarred);
    }
  }, [currentSong?.id, song.id, isSongStarred, setIsStarred]);

  return (
    <>
      <OptionsButtons.Like
        variant={variant}
        isStarred={isStarred}
        onClick={(e) => {
          e.stopPropagation();
          toggleStar();
        }}
      />
      <ContextMenuSeparator />
    </>
  );
}

interface SongMenuOptionsProps {
  variant: "context" | "dropdown";
  song: ISong;
  index: number;
  showLikeOption?: boolean;
}

export function SongMenuOptions({
  variant,
  song,
  index,
  showLikeOption = false,
}: SongMenuOptionsProps) {
  const navigate = useNavigate();
  const {
    playNext,
    playLast,
    createNewPlaylist,
    addToPlaylist,
    removeSongFromPlaylist,
    openSongInfo,
    isOnPlaylistPage,
  } = useOptions();
  const songIndexes = [index.toString()];
  const isCached = useIsAudioCached(song.id);
  const libraryCaching = useLibraryCaching();
  const isUserQueueEmpty = usePlayerStore(
    (state) => state.songlist.userQueue.songs.length === 0,
  );

  return (
    <>
      {showLikeOption && <MenuLikeButton variant={variant} song={song} />}
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
