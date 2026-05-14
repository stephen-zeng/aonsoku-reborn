import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  side: "left" | "right";
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export function ResizeHandle({
  side,
  onMouseDown,
  onDoubleClick,
}: ResizeHandleProps) {
  return (
    <div
      role="presentation"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        "absolute top-0 bottom-0 z-50 w-1 cursor-col-resize",
        "hover-supported:bg-primary/40 active:bg-primary/60",
        "before:absolute before:top-0 before:bottom-0 before:w-4 before:left-1/2 before:-translate-x-1/2",
        side === "right" && "-right-0.5",
        side === "left" && "-left-0.5",
      )}
    />
  );
}
