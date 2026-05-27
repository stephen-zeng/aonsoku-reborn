import Autoplay from "embla-carousel-autoplay";
import { useState } from "react";
import { HeaderItem } from "@/app/components/home/carousel/header-item";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/app/components/ui/carousel";
import { useEmblaWheelScroll } from "@/app/hooks/use-embla-wheel-scroll";
import { Albums } from "@/types/responses/album";

interface HomeHeaderProps {
  albums: Albums[];
}

export default function HomeHeader({ albums }: HomeHeaderProps) {
  const [api, setApi] = useState<CarouselApi>();
  const { onWheel } = useEmblaWheelScroll(api);

  if (albums.length === 0) return null;

  return (
    <Carousel
      className="w-full border rounded-lg overflow-hidden z-10 group"
      opts={{
        loop: true,
      }}
      plugins={[
        Autoplay({
          delay: 10000,
        }),
      ]}
      setApi={setApi}
      onWheel={onWheel}
      data-testid="header-carousel"
    >
      <CarouselContent
        className="ml-0 flex transform-gpu"
        style={{ borderRadius: "calc(var(--radius) - 2px)" }}
      >
        {albums.map((album, index) => (
          <CarouselItem
            key={album.id}
            className="pl-0 basis-full maskImage-carousel-item"
            data-testid={`carousel-header-album-${index}`}
          >
            <HeaderItem album={album} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="absolute right-4 bottom-1 flex gap-2 z-20 opacity-0 group-hover-supported:opacity-100 transition-opacity duration-300">
        <CarouselPrevious
          className="static shadow-sm"
          data-testid="header-carousel-previous"
        />
        <CarouselNext
          className="static shadow-sm"
          data-testid="header-carousel-next"
        />
      </div>
    </Carousel>
  );
}
