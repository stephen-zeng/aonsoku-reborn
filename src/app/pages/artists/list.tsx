import { useIsMobile } from "@/app/hooks/use-mobile";
import MobileArtistsList from "@/app/pages/mobile/artists";
import DesktopArtistsList from "./desktop-list";

export default function ArtistsList() {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileArtistsList />;

  return <DesktopArtistsList />;
}
