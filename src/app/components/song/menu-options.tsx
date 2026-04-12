import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { ContextMenuSeparator } from "@/app/components/ui/context-menu";
import { useOptions } from "@/app/hooks/use-options";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import {
  usePlayerActions,
  usePlayerMediaType,
  usePlayerSonglist,
} from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { AddToPlaylistSubMenu } from "./add-to-playlist";

interface MenuLikeButtonProps {
  variant: "context" | "dropdown";
  song: ISong;
}

function MenuLikeButton({ variant, song }: MenuLikeButtonProps) {
  const [isStarred, setIsStarred] = useState(
    typeof song.starred === "string",
  );
  const { currentSong } = usePlayerSonglist();
  const { isSong } = usePlayerMediaType();
  const { starCurrentSong, starSongInQueue } = usePlayerActions();

  async function handleToggleStar() {
    const newState = !isStarred;
    await subsonic.star.handleStarItem({
      id: song.id,
      starred: isStarred,
    });
    setIsStarred(newState);

    if (isSong) {
      const isSongPlaying = currentSong.id === song.id;
      isSongPlaying ? starCurrentSong() : starSongInQueue(song.id);
    }
  }

  return (
    <>
      <OptionsButtons.Like
        variant={variant}
        isStarred={isStarred}
        onClick={(e) => {
          e.stopPropagation();
          handleToggleStar();
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
    startDownload,
    openSongInfo,
    isOnPlaylistPage,
  } = useOptions();
  const songIndexes = [index.toString()];

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
