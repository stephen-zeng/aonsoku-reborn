import { Minus, Pin, PinOff, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { hasElectronBridge } from "@/utils/desktop";

export function MiniPlayerWindowControls() {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (hasElectronBridge() && window.api.isAlwaysOnTop) {
      window.api.isAlwaysOnTop().then(setIsAlwaysOnTop);
    }
  }, []);

  const handleMinimize = useCallback(() => {
    if (hasElectronBridge()) {
      window.api.toggleMinimize();
    }
  }, []);

  const handleAlwaysOnTop = useCallback(() => {
    if (hasElectronBridge() && window.api.setAlwaysOnTop) {
      const newState = !isAlwaysOnTop;
      window.api.setAlwaysOnTop(newState);
      setIsAlwaysOnTop(newState);
    }
  }, [isAlwaysOnTop]);

  const handleClose = useCallback(() => {
    if (hasElectronBridge()) {
      window.api.closeWindow();
    }
  }, []);

  if (!hasElectronBridge()) return null;

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 rounded-full hover:bg-accent/50 text-foreground/70 hover:text-foreground"
        onClick={handleAlwaysOnTop}
        title={isAlwaysOnTop ? "Disable Always on Top" : "Enable Always on Top"}
      >
        {isAlwaysOnTop ? <PinOff size={14} /> : <Pin size={14} />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 rounded-full hover:bg-accent/50 text-foreground/70 hover:text-foreground"
        onClick={handleMinimize}
        title="Minimize"
      >
        <Minus size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 rounded-full hover:bg-red-500/20 text-foreground/70 hover:text-red-500"
        onClick={handleClose}
        title="Close"
      >
        <X size={14} />
      </Button>
    </div>
  );
}
