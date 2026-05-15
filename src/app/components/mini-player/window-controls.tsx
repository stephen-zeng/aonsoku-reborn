import { ExternalLink, X } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { hasElectronBridge } from "@/utils/desktop";

export function MiniPlayerWindowControls() {
  const handleFocusMain = useCallback(() => {
    if (hasElectronBridge()) {
      window.api.focusMainWindow();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (hasElectronBridge()) {
      window.api.closeWindow();
    }
  }, []);

  if (!hasElectronBridge()) return null;

  return (
    <div className="flex items-center gap-0.5 justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7 rounded-full hover:bg-accent/50 text-foreground/70 hover:text-foreground"
        onClick={handleFocusMain}
        title="Open Main Window"
      >
        <ExternalLink size={14} />
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
