import { ComponentPropsWithoutRef, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { IMAGE_HEADER_EFFECT_GRADIENT } from "./image-header-gradients";

export const ImageHeaderEffect = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        IMAGE_HEADER_EFFECT_GRADIENT,
        "absolute top-full w-full h-24 md:h-64 z-0 pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
ImageHeaderEffect.displayName = "ImageHeaderEffect";
