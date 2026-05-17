import { MiniPlayerWindowControls } from "./window-controls";
import { cn } from "@/lib/utils";
import { hasElectronBridge, isDesktop } from "@/utils/desktop";

export function MiniPlayerTitleBar() {
  if (!isDesktop() || !hasElectronBridge()) return null;

  return (
    <div 
      className={cn(
        "h-8 mini-player:h-7 shrink-0 flex items-center justify-between w-full relative",
        "bg-secondary/10 border-b border-border/30 backdrop-blur-md"
      )}
    >
      <div 
        className="flex-1 h-full flex items-center px-3" 
        style={{ WebkitAppRegion: "drag" }}
      >
        <span className="text-[10px] uppercase tracking-widest font-medium text-foreground/40 select-none">
          aonsoku
        </span>
      </div>
      <div className="flex items-center h-full shrink-0" style={{ WebkitAppRegion: "no-drag" }}>
        <MiniPlayerWindowControls />
      </div>
    </div>
  );
}

