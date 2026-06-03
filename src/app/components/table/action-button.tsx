import clsx from "clsx";
import { EllipsisVertical } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { useTouchMenuGuard } from "@/app/hooks/use-touch-menu-guard";

interface TableActionButtonProps {
  optionsMenuItems?: ReactNode;
}

export function TableActionButton({
  optionsMenuItems,
}: TableActionButtonProps) {
  const hasHover = useHasHover();
  const { open, setOpen, triggerProps } = useTouchMenuGuard();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="inline-flex"
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
              "opacity-0 group-hover-supported/tablerow:opacity-100 transition-opacity",
              !hasHover && "opacity-100",
              triggerProps.className,
            )}
            onPointerDown={triggerProps.onPointerDown}
            onPointerMove={triggerProps.onPointerMove}
            onPointerUp={triggerProps.onPointerUp}
            onPointerCancel={triggerProps.onPointerCancel}
            onClick={triggerProps.onClick}
            onContextMenu={triggerProps.onContextMenu}
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
    </div>
  );
}
