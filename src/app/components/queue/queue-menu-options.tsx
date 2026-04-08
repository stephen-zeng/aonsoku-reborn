import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { ContextMenuSeparator } from "@/app/components/ui/context-menu";
import { AddToPlaylistSubMenu } from "@/app/components/song/add-to-playlist";
import { useOptions } from "@/app/hooks/use-options";
import { ROUTES } from "@/routes/routesList";
import { usePlayerActions } from "@/store/player.store";
import { ISong } from "@/types/responses/song";

interface QueueMenuOptionsProps {
  variant: "context" | "dropdown";
  song: ISong;
}

export function QueueMenuOptions({ variant, song }: QueueMenuOptionsProps) {
  const navigate = useNavigate();
  const { removeSongFromQueue } = usePlayerActions();
  const {
    playNext,
    playLast,
    createNewPlaylist,
    addToPlaylist,
    startDownload,
    openSongInfo,
  } = useOptions();

  return (
    <>
      <OptionsButtons.RemoveFromQueue
        variant={variant}
        onClick={(e) => {
          e.stopPropagation();
          removeSongFromQueue(song.id);
        }}
      />
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
