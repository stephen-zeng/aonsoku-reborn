import { useIsMobile } from "@/app/hooks/use-mobile";
import MobileSongsList from "@/app/pages/mobile/songs";
import DesktopSongList from "./desktop-songlist";

export default function SongList() {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileSongsList />;

  return <DesktopSongList />;
}
