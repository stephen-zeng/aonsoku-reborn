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
    <div className="flex items-center justify-end h-full">
      <Button
        variant="ghost"
        size="icon"
        className="w-10 h-full rounded-none hover:bg-accent/80 text-foreground/70 hover:text-foreground transition-colors"
        onClick={handleFocusMain}
        title="Open Main Window"
      >
        <ExternalLink size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-10 h-full rounded-none hover:bg-red-500 hover:text-white text-foreground/70 transition-colors"
        onClick={handleClose}
        title="Close"
      >
        <X size={14} />
      </Button>
    </div>
  );
}
