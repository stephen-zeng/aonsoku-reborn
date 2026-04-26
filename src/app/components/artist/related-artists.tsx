import { useMemo } from "react";
import { PreviewCard } from "@/app/components/preview-card/card";
import { CarouselButton } from "@/app/components/ui/carousel-button";
import { useScrollCarousel } from "@/app/hooks/use-scroll-carousel";
import { useSongList } from "@/app/hooks/use-song-list";
import { ROUTES } from "@/routes/routesList";
import { usePlayerActions } from "@/store/player.store";
import { ISimilarArtist } from "@/types/responses/artist";

interface RelatedArtistsListProps {
  title: string;
  similarArtists: ISimilarArtist[];
}

export default function RelatedArtistsList({
  title,
  similarArtists,
}: RelatedArtistsListProps) {
  const { getArtistAllSongs } = useSongList();
  const { canScrollPrev, canScrollNext, handleScroll, scrollCarouselProps } =
    useScrollCarousel(title);
  const { setSongList } = usePlayerActions();
  const displayList = useMemo(
    () => similarArtists.slice(0, 16),
    [similarArtists],
  );

  async function handlePlayArtistRadio(artist: ISimilarArtist) {
    const songList = await getArtistAllSongs(artist.id);
    if (songList) setSongList(songList, 0, false, undefined, artist.name);
  }

  return (
    <div className="w-full flex flex-col mb-4">
      <div className="my-4 flex justify-between items-center">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
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
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pl-4 scroll-pl-4 pr-4 scroll-pr-4 no-scrollbar"
      >
        {displayList.map((artist, index) => (
          <div
            key={artist.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${displayList.length}`}
            className="shrink-0 snap-start w-1/6 2xl:w-1/8"
          >
            <PreviewCard.Root>
              <PreviewCard.ImageWrapper link={ROUTES.ARTIST.PAGE(artist.id)}>
                <PreviewCard.Image
                  coverArtId={artist.coverArt}
                  coverArtType="artist"
                  alt={artist.name}
                />
                <PreviewCard.PlayButton
                  onClick={() => handlePlayArtistRadio(artist)}
                />
              </PreviewCard.ImageWrapper>
              <PreviewCard.InfoWrapper>
                <PreviewCard.Subtitle
                  link={ROUTES.ARTIST.PAGE(artist.id)}
                  className="mt-2"
                >
                  {artist.name}
                </PreviewCard.Subtitle>
              </PreviewCard.InfoWrapper>
            </PreviewCard.Root>
          </div>
        ))}
      </div>
    </div>
  );
}
