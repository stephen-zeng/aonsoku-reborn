import { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/store/ui.store";

type ShadowHeaderProps = ComponentProps<"div"> & {
  showGlassEffect?: boolean;
  fixed?: boolean;
};

export function ShadowHeader({
  children,
  className,
  showGlassEffect = true,
  fixed = true,
  ...rest
}: ShadowHeaderProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex items-center justify-start px-8 h-[--shadow-header-height] border-b bg-background",
        fixed && "fixed top-header right-0 left-0 md:left-mini-sidebar z-30",
        fixed && (isCollapsed ? "xl:left-mini-sidebar" : "xl:left-sidebar"),
        showGlassEffect &&
          "backdrop-blur-lg supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
