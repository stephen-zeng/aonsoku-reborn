import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ReactNode } from "react";
import { VolumeSlider } from "@/app/components/player/volume";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export function MiniPlayerPopoverVolume({ children }: { children: ReactNode }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          className="rounded-full w-10 h-10 p-2 text-secondary-foreground data-[state=open]:bg-accent"
          unfocusable
        >
          {children}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        className={cn(
          "z-50 w-fit h-10 px-4 py-0 flex items-center rounded-full",
          "bg-popover border text-popover-foreground shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        )}
        side="top"
        align="center"
        sideOffset={4}
      >
        <VolumeSlider className="w-24" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
