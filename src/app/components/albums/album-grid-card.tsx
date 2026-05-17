import { memo } from "react";
import { PreviewCard } from "@/app/components/preview-card/card";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { Albums } from "@/types/responses/album";

type AlbumCardProps = {
  album: Albums;
};

function AlbumCard({ album }: AlbumCardProps) {
  const { setSongList } = usePlayerActions();
  const hasHover = useHasHover();

  async function handlePlayAlbum() {
    const response = await subsonic.albums.getOne(album.id);

    if (response) {
      setSongList(response.song, 0, false, { albumId: album.id }, album.name);
    }
  }

  return (
    <PreviewCard.Root>
      <PreviewCard.ImageWrapper link={ROUTES.ALBUM.PAGE(album.id)}>
        <PreviewCard.Image
          coverArtId={album.coverArt}
          coverArtType="album"
          alt={album.name}
        />
        {hasHover && <PreviewCard.PlayButton onClick={handlePlayAlbum} />}
      </PreviewCard.ImageWrapper>
      <PreviewCard.InfoWrapper>
        <PreviewCard.Title link={ROUTES.ALBUM.PAGE(album.id)}>
          {album.name}
        </PreviewCard.Title>
        <PreviewCard.Subtitle
          enableLink={album.artistId !== undefined}
          link={ROUTES.ARTIST.PAGE(album.artistId ?? "")}
        >
          {album.artist}
        </PreviewCard.Subtitle>
      </PreviewCard.InfoWrapper>
    </PreviewCard.Root>
  );
}

export const AlbumGridCard = memo(AlbumCard);
