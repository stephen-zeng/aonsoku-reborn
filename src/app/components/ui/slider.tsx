import * as SliderPrimitive from "@radix-ui/react-slider";
import { clsx } from "clsx";
import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "secondary";

type SliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  variant?: Variant;
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, variant = "default", ...props }, ref) => {
  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={clsx(
          "relative h-1 w-full grow overflow-hidden rounded-full select-none",
          variant === "default" && "bg-secondary",
          variant === "secondary" && "bg-muted-foreground/70",
        )}
        onContextMenu={handleContextMenu}
      >
        <SliderPrimitive.Range
          className={clsx(
            "absolute h-full select-none rounded",
            variant === "default" && "bg-primary",
            variant === "secondary" && "bg-secondary-foreground",
          )}
          onContextMenu={handleContextMenu}
        />
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb
        className={clsx(
          "block opacity-0 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full",
          "border-2 ring-offset-background transition-[background-color,opacity]",
          "focus-visible:outline-none focus-visible:ring-transparent",
          "disabled:pointer-events-none disabled:opacity-50 transform-gpu",
          variant === "default" && "bg-foreground border-foreground",
          variant === "secondary" &&
            "bg-secondary-foreground border-secondary-foreground",
        )}
        onKeyDown={(e) => e.preventDefault()}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

type ProgressSliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  variant?: Variant;
  isBuffering?: boolean;
};

export function ProgressSlider(props: ProgressSliderProps) {
  const {
    className,
    variant = "default",
    isBuffering = false,
    onValueChange,
    ...rest
  } = props;

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
        className,
      )}
      onValueChange={([value]) => {
        if (onValueChange) onValueChange([value]);
      }}
      {...rest}
    >
      <SliderPrimitive.Track
        className={clsx(
          "relative h-1 w-full grow overflow-hidden rounded-full select-none",
          variant === "default" && !isBuffering && "bg-secondary",
          variant === "default" && isBuffering && "bg-secondary animate-pulse",
          variant === "secondary" && "bg-muted-foreground/70",
        )}
        onContextMenu={handleContextMenu}
      >
        <SliderPrimitive.Range
          className={clsx(
            "absolute h-full select-none rounded",
            variant === "default" && "bg-primary",
            variant === "secondary" && "bg-secondary-foreground",
          )}
          onContextMenu={handleContextMenu}
        />
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb
        className={clsx(
          "block opacity-0 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full",
          "border-2 transition-[background-color,opacity]",
          "focus-visible:outline-none focus-visible:ring-transparent",
          "disabled:pointer-events-none disabled:opacity-50 transform-gpu",
          variant === "default" && "bg-foreground border-foreground",
          variant === "secondary" &&
            "bg-secondary-foreground border-secondary-foreground",
        )}
        onKeyDown={(e) => e.preventDefault()}
      />
    </SliderPrimitive.Root>
  );
}
