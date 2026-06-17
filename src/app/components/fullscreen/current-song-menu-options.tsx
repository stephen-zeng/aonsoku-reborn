import { useNavigate } from "react-router-dom";
import { OptionsButtons } from "@/app/components/options/buttons";
import { AddToPlaylistSubMenu } from "@/app/components/song/add-to-playlist";
import { DropdownMenuSeparator } from "@/app/components/ui/dropdown-menu";
import { useOptions } from "@/app/hooks/use-options";
import { ROUTES } from "@/routes/routesList";
import { ISong } from "@/types/responses/song";

interface CurrentSongMenuOptionsProps {
  song: ISong;
}

export function CurrentSongMenuOptions({ song }: CurrentSongMenuOptionsProps) {
  const navigate = useNavigate();
  const { createNewPlaylist, addToPlaylist, openSongInfo } = useOptions();

  return (
    <>
      <OptionsButtons.AddToPlaylistOption variant="dropdown">
        <AddToPlaylistSubMenu
          type="dropdown"
          newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
          addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
        />
      </OptionsButtons.AddToPlaylistOption>
      <DropdownMenuSeparator />
      {(song.artistId || song.albumId) && (
        <>
          {song.artistId && (
            <OptionsButtons.GotoArtist
              variant="dropdown"
              onClick={(e) => {
                e.stopPropagation();
                navigate(ROUTES.ARTIST.PAGE(song.artistId!));
              }}
            />
          )}
          {song.albumId && (
            <OptionsButtons.GotoAlbum
              variant="dropdown"
              onClick={(e) => {
                e.stopPropagation();
                navigate(ROUTES.ALBUM.PAGE(song.albumId));
              }}
            />
          )}
          <DropdownMenuSeparator />
        </>
      )}
      <OptionsButtons.SongInfo
        variant="dropdown"
        onClick={(e) => {
          e.stopPropagation();
          openSongInfo(song.id);
        }}
      />
    </>
  );
}
