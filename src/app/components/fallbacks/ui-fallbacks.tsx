import type { ReactNode } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/store/ui.store";

interface ShadowHeaderFallbackProps {
  actions?: ReactNode;
  hasCount?: boolean;
}

export function ShadowHeaderFallback({
  actions,
  hasCount = true,
}: ShadowHeaderFallbackProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex items-center justify-start px-4 md:px-8 h-[--shadow-header-height] border-b bg-background pt-[var(--safe-area-top)]",
        "fixed top-header right-0 left-0 md:left-mini-sidebar z-30",
        isCollapsed ? "xl:left-mini-sidebar" : "xl:left-sidebar",
        "backdrop-blur-lg supports-[backdrop-filter]:bg-background/80",
        "transition-[left] duration-300",
      )}
    >
      <div className="w-full flex justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-28 h-8" />
          {hasCount && <Skeleton className="w-11 h-[22px] rounded-full" />}
        </div>
        {actions && (
          <div className="flex gap-2 justify-end flex-wrap">{actions}</div>
        )}
      </div>
    </div>
  );
}

export function AddButtonSkeleton() {
  return (
    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 bg-primary/50">
      <Skeleton className="w-5 h-5 -ml-[3px] rounded-sm" />
      <Skeleton className="w-16 h-4 ml-2" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="cursor-pointer">
      <Skeleton className="aspect-square rounded overflow-hidden" />
      <div className="flex flex-col cursor-default pt-2 gap-1.5">
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ButtonsBarFallback({ children }: { children: ReactNode }) {
  return (
    <div className="w-full my-3 md:my-6 flex gap-1 items-center justify-center md:justify-start">
      {children}
    </div>
  );
}

export function DetailButtonsFallback() {
  return (
    <ButtonsBarFallback>
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
      <Skeleton className="rounded-full w-14 h-14 md:order-first" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14 hidden md:inline-flex" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14 hidden md:inline-flex" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
    </ButtonsBarFallback>
  );
}
