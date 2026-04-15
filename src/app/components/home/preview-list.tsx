import { useMemo } from "react";
import { isMobile } from "react-device-detect";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PreviewCard } from "@/app/components/preview-card/card";
import { CarouselButton } from "@/app/components/ui/carousel-button";
import { useScrollCarousel } from "@/app/hooks/use-scroll-carousel";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { Albums } from "@/types/responses/album";

interface PreviewListProps {
  list: Albums[];
  title: string;
  showMore?: boolean;
  moreTitle?: string;
  moreRoute?: string;
}

export default function PreviewList({
  list,
  title,
  showMore = true,
  moreTitle,
  moreRoute,
}: PreviewListProps) {
  const { canScrollPrev, canScrollNext, handleScroll, scrollCarouselProps } =
    useScrollCarousel(title);
  const { setSongList } = usePlayerActions();
  const { t } = useTranslation();

  moreTitle = moreTitle || t("generic.seeMore");
  const displayList = useMemo(() => list.slice(0, 16), [list]);

  async function handlePlayAlbum(album: Albums) {
    const response = await subsonic.albums.getOne(album.id);

    if (response) {
      setSongList(response.song, 0, false, { albumId: album.id }, album.name);
    }
  }

  return (
    <div className="w-full flex flex-col mt-4">
      <div className="my-4 flex justify-between items-center">
        <h3
          className="scroll-m-20 text-lg sm:text-2xl font-semibold tracking-tight"
          data-testid="preview-list-title"
        >
          {title}
        </h3>
        <div className="flex items-center gap-4">
          {showMore && moreRoute && (
            <Link to={moreRoute} data-testid="preview-list-show-more">
              <p className="leading-7 text-sm truncate hover:underline text-muted-foreground hover:text-primary">
                {moreTitle}
              </p>
            </Link>
          )}
          <div className="hidden sm:flex gap-2">
            <CarouselButton
              direction="prev"
              disabled={!canScrollPrev}
              onClick={() => handleScroll("prev")}
              data-testid="preview-list-prev-button"
            />
            <CarouselButton
              direction="next"
              disabled={!canScrollNext}
              onClick={() => handleScroll("next")}
              data-testid="preview-list-next-button"
            />
          </div>
        </div>
      </div>

      <div
        {...scrollCarouselProps}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-4 scroll-pl-4 pr-4 scroll-pr-4 no-scrollbar"
        data-testid="preview-list-carousel"
      >
        {displayList.map((album, index) => (
          <div
            key={album.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${displayList.length}`}
            className="shrink-0 snap-start w-1/3 sm:w-1/6 2xl:w-1/8"
            data-testid={`preview-list-carousel-item-${index}`}
          >
            <PreviewCard.Root>
              <PreviewCard.ImageWrapper link={ROUTES.ALBUM.PAGE(album.id)}>
                <PreviewCard.Image
                  coverArtId={album.coverArt}
                  coverArtType="album"
                  alt={album.name}
                />
                {!isMobile && (
                  <PreviewCard.PlayButton
                    onClick={() => handlePlayAlbum(album)}
                  />
                )}
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
          </div>
        ))}
      </div>
    </div>
  );
}
