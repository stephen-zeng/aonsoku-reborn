import { MiniPlayerWindowControls } from "./window-controls";
import { cn } from "@/lib/utils";
import { hasElectronBridge, isDesktop } from "@/utils/desktop";

export function MiniPlayerTitleBar() {
  if (!isDesktop() || !hasElectronBridge()) return null;

  return (
    <div 
      className={cn(
        "h-8 mini-player:h-7 shrink-0 flex items-center justify-between px-2 w-full",
        "bg-transparent"
      )}
    >
      <div 
        className="flex-1 h-full" 
        style={{ WebkitAppRegion: "drag" }}
      />
      <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" }}>
        <MiniPlayerWindowControls />
      </div>
    </div>
  );
}

