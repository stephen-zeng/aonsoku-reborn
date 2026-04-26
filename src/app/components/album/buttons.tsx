import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Actions } from "@/app/components/actions";
import { OptionsButtons } from "@/app/components/options/buttons";
import {
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { subsonic } from "@/service/subsonic";
import { useAppPages } from "@/store/app.store";
import { usePlayerActions } from "@/store/player.store";
import { SingleAlbum } from "@/types/responses/album";
import { queryKeys } from "@/utils/queryKeys";
import { AlbumOptions } from "./options";

interface AlbumButtonsProps {
  album: SingleAlbum;
  showInfoButton: boolean;
}

export function AlbumButtons({ album, showInfoButton }: AlbumButtonsProps) {
  const { t } = useTranslation();
  const { setSongList } = usePlayerActions();
  const { showInfoPanel, toggleShowInfoPanel } = useAppPages();

  const isAlbumStarred = album.starred !== undefined;

  const queryClient = useQueryClient();

  const starMutation = useMutation({
    mutationFn: subsonic.star.handleStarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [queryKeys.album.single, album.id],
      });
    },
  });

  function handleLikeButton() {
    if (!album) return;

    starMutation.mutate({
      id: album.id,
      starred: isAlbumStarred,
    });
  }

  const buttonsTooltips = {
    play: t("playlist.buttons.play", { name: album.name }),
    shuffle: t("playlist.buttons.shuffle", { name: album.name }),
    options: t("playlist.buttons.options", { name: album.name }),
    like: () => {
      return isAlbumStarred
        ? t("album.buttons.dislike", { name: album.name })
        : t("album.buttons.like", { name: album.name });
    },
    info: () => {
      return showInfoPanel
        ? t("generic.hideDetails")
        : t("generic.showDetails");
    },
  };

  return (
    <Actions.Container>
      {album.song.length > 1 && (
        <Actions.Button
          tooltip={buttonsTooltips.shuffle}
          onClick={() =>
            setSongList(album.song, 0, true, { albumId: album.id }, album.name)
          }
        >
          <Actions.ShuffleIcon />
        </Actions.Button>
      )}

      <Actions.Button
        tooltip={buttonsTooltips.play}
        buttonStyle="primary"
        className="md:order-first"
        onClick={() =>
          setSongList(album.song, 0, false, { albumId: album.id }, album.name)
        }
      >
        <Actions.PlayIcon />
      </Actions.Button>

      <Actions.Button
        tooltip={buttonsTooltips.like()}
        className="hidden md:inline-flex"
        onClick={handleLikeButton}
      >
        <Actions.LikeIcon isStarred={isAlbumStarred} />
      </Actions.Button>

      {showInfoButton && (
        <Actions.Button
          tooltip={buttonsTooltips.info()}
          className="hidden md:inline-flex"
          onClick={toggleShowInfoPanel}
        >
          <Actions.InfoIcon />
        </Actions.Button>
      )}

      <Actions.Dropdown
        tooltip={buttonsTooltips.options}
        options={
          <>
            <DropdownMenuGroup className="md:hidden">
              <OptionsButtons.Like
                onClick={handleLikeButton}
                isStarred={isAlbumStarred}
                label={buttonsTooltips.like()}
              />
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="md:hidden" />
            <AlbumOptions album={album} />
          </>
        }
      />
    </Actions.Container>
  );
}
