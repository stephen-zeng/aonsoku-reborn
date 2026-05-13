import clsx from "clsx";
import { EllipsisVertical } from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

interface TableActionButtonProps {
  optionsMenuItems?: ReactNode;
}

export function TableActionButton({
  optionsMenuItems,
}: TableActionButtonProps) {
  const [open, setOpen] = useState(false);
  const hasHover = useHasHover();
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <DropdownMenu open={open} onOpenChange={(state) => setOpen(state)}>
      <DropdownMenuTrigger
        asChild
        className="outline-none focus-visible:ring-0 focus-visible:ring-transparent ring-0 ring-offset-transparent"
      >
        <Button
          variant="ghost"
          size="icon"
          className={clsx(
            "w-8 h-8 p-1 rounded-full",
            "data-[state=open]:bg-accent data-[state=open]:opacity-100",
            "opacity-0 group-hover/tablerow:opacity-100 transition-opacity",
            !hasHover && "opacity-100",
            "touch-pan-y select-none",
          )}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              // Record position and stop propagation to prevent Radix from
              // opening the menu immediately on touch down.
              pointerStartPos.current = { x: e.clientX, y: e.clientY };
              e.stopPropagation();
            }
          }}
          onPointerUp={(e) => {
            if (e.pointerType === "touch") {
              if (!pointerStartPos.current) return;

              const deltaX = Math.abs(e.clientX - pointerStartPos.current.x);
              const deltaY = Math.abs(e.clientY - pointerStartPos.current.y);
              pointerStartPos.current = null;

              // If the pointer moved more than 10px, it's a swipe/scroll.
              if (deltaX > 10 || deltaY > 10) {
                return;
              }

              e.stopPropagation();
              setOpen(true);
            }
          }}
          onClick={(e) => {
            const isTouch =
              e.nativeEvent instanceof PointerEvent &&
              e.nativeEvent.pointerType === "touch";

            if (isTouch) {
              // Handled in onPointerUp for touch devices.
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            // Normal click for mouse.
            e.stopPropagation();
            setOpen(true);
          }}
          unfocusable
        >
          <EllipsisVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      {optionsMenuItems && (
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {optionsMenuItems}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
