import { useIsMobile } from "@/app/hooks/use-mobile";
import MobileAlbumsList from "@/app/pages/mobile/albums";
import DesktopAlbumsList from "./desktop-list";

export default function AlbumsList() {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileAlbumsList />;

  return <DesktopAlbumsList />;
}
