import { MiniPlayerWindowControls } from "./window-controls";
import { cn } from "@/lib/utils";
import { hasElectronBridge } from "@/utils/desktop";

export function MiniPlayerTitleBar() {
  if (!hasElectronBridge()) return null;

  return (
    <div 
      className={cn(
        "absolute top-0 left-0 right-0 h-8 z-50 flex items-center justify-between px-2",
        "bg-gradient-to-b from-background/80 to-transparent backdrop-blur-[2px]",
        "opacity-0 group-hover/player:opacity-100 transition-opacity duration-200",
        "select-none pointer-events-none"
      )}
    >
      <div 
        className="flex-1 h-full pointer-events-auto" 
        style={{ WebkitAppRegion: "drag" }}
      />
      <div className="flex items-center pointer-events-auto" style={{ WebkitAppRegion: "no-drag" }}>
        <MiniPlayerWindowControls />
      </div>
    </div>
  );
}
