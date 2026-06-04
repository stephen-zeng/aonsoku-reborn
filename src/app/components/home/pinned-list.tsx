import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PreviewCard } from "@/app/components/preview-card/card";
import { CarouselButton } from "@/app/components/ui/carousel-button";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { useScrollCarousel } from "@/app/hooks/use-scroll-carousel";
import {
  type HomePinnedAlbumItem,
  type HomePinnedItemData,
  type HomePinnedPlaylistItem,
} from "@/app/hooks/use-home";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { convertSecondsToHumanRead } from "@/utils/convertSecondsToTime";

interface PinnedListProps {
  list: HomePinnedItemData[];
  title: string;
}

function PinnedListSubtitle({ item }: { item: HomePinnedItemData }) {
  const { t } = useTranslation();

  if (item.type === "album") {
    return (
      <PreviewCard.Subtitle
        enableLink={item.album.artistId !== undefined}
        link={ROUTES.ARTIST.PAGE(item.album.artistId ?? "")}
      >
        {item.album.artist}
      </PreviewCard.Subtitle>
    );
  }

  const details: string[] = [t("playlist.headline")];
  const hasSongs = item.playlist.songCount > 0;

  if (hasSongs) {
    details.push(t("playlist.songCount", { count: item.playlist.songCount }));
  }

  if (item.playlist.duration > 0) {
    details.push(
      t("playlist.duration", {
        duration: convertSecondsToHumanRead(item.playlist.duration),
      }),
    );
  }

  return (
    <PreviewCard.Subtitle enableLink={false}>
      {details.join(" / ")}
    </PreviewCard.Subtitle>
  );
}

function getItemLink(item: HomePinnedItemData) {
  return item.type === "album"
    ? ROUTES.ALBUM.PAGE(item.album.id)
    : ROUTES.PLAYLIST.PAGE(item.playlist.id);
}

function getCoverArt(item: HomePinnedItemData) {
  return item.type === "album"
    ? {
        alt: item.album.name,
        coverArtId: item.album.coverArt,
        coverArtType: "album" as const,
      }
    : {
        alt: item.playlist.name,
        coverArtId: item.playlist.coverArt,
        coverArtType: "playlist" as const,
      };
}

export default function PinnedList({ list, title }: PinnedListProps) {
  const { canScrollPrev, canScrollNext, handleScroll, scrollCarouselProps } =
    useScrollCarousel(title);
  const { setSongList } = usePlayerActions();
  const hasHover = useHasHover();

  const displayList = useMemo(() => list.slice(0, 16), [list]);

  async function handlePlayAlbum(item: HomePinnedAlbumItem) {
    const response = await subsonic.albums.getOne(item.album.id);

    if (response) {
      setSongList(
        response.song,
        0,
        false,
        { albumId: item.album.id },
        item.album.name,
      );
    }
  }

  async function handlePlayPlaylist(item: HomePinnedPlaylistItem) {
    const playlist =
      item.detail ?? (await subsonic.playlists.getOne(item.playlist.id));

    if (playlist) {
      setSongList(
        playlist.entry,
        0,
        false,
        { playlistId: item.playlist.id },
        item.playlist.name,
      );
    }
  }

  async function handlePlay(item: HomePinnedItemData) {
    if (item.type === "album") {
      await handlePlayAlbum(item);
      return;
    }

    await handlePlayPlaylist(item);
  }

  return (
    <div className="w-full flex flex-col mt-4">
      <div className="my-4 flex justify-between items-center">
        <h3 className="scroll-m-20 text-lg sm:text-2xl font-semibold tracking-tight">
          {title}
        </h3>
        <div className="hidden sm:flex gap-2">
          <CarouselButton
            direction="prev"
            disabled={!canScrollPrev}
            onClick={() => handleScroll("prev")}
          />
          <CarouselButton
            direction="next"
            disabled={!canScrollNext}
            onClick={() => handleScroll("next")}
          />
        </div>
      </div>

      <div
        {...scrollCarouselProps}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scroll-pl-0 scroll-pr-0 no-scrollbar sm:pl-4 sm:pr-4 sm:scroll-pl-4 sm:scroll-pr-4"
      >
        {displayList.map((item, index) => {
          const link = getItemLink(item);
          const titleText =
            item.type === "album" ? item.album.name : item.playlist.name;
          const coverArt = getCoverArt(item);

          return (
            <div
              key={
                item.type === "album"
                  ? `album-${item.album.id}`
                  : `playlist-${item.playlist.id}`
              }
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${displayList.length}`}
              className="shrink-0 snap-start w-1/3 sm:w-1/6 2xl:w-1/8"
            >
              <PreviewCard.Root>
                <PreviewCard.ImageWrapper link={link}>
                  <PreviewCard.Image
                    coverArtId={coverArt.coverArtId}
                    coverArtType={coverArt.coverArtType}
                    alt={coverArt.alt}
                  />
                  {hasHover && (
                    <PreviewCard.PlayButton onClick={() => handlePlay(item)} />
                  )}
                </PreviewCard.ImageWrapper>
                <PreviewCard.InfoWrapper>
                  <PreviewCard.Title link={link}>{titleText}</PreviewCard.Title>
                  <PinnedListSubtitle item={item} />
                </PreviewCard.InfoWrapper>
              </PreviewCard.Root>
            </div>
          );
        })}
      </div>
    </div>
  );
}
