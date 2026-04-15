import { useIsMobile } from "@/app/hooks/use-mobile";
import { DesktopLayout } from "./desktop-layout";
import { MobileLayout } from "./mobile-layout";

export function FullscreenContent() {
  const isMobile = useIsMobile();

  return isMobile ? <MobileLayout showDragHandle /> : <DesktopLayout />;
}
