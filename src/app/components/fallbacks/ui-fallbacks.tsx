import type { ReactNode } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";

interface ShadowHeaderFallbackProps {
  actions?: ReactNode;
  hasCount?: boolean;
}

export function ShadowHeaderFallback({
  actions,
  hasCount = true,
}: ShadowHeaderFallbackProps) {
  return (
    <div className="flex items-center justify-between px-4 md:px-8 h-[--shadow-header-height] border-b bg-background relative w-full">
      <div className="flex items-center gap-2">
        <Skeleton className="w-28 h-8" />
        {hasCount && <Skeleton className="w-11 h-[22px] rounded-full" />}
      </div>
      {actions && (
        <div className="flex gap-2 flex-1 justify-end flex-wrap">{actions}</div>
      )}
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
    <>
      <Skeleton className="aspect-square" />
      <Skeleton className="h-[13px] w-11/12 mt-2" />
      <Skeleton className="h-3 w-1/2 mt-[7px]" />
    </>
  );
}

export function ButtonsBarFallback({ children }: { children: ReactNode }) {
  return (
    <div className="w-full my-3 md:my-6 flex gap-1 items-center justify-center md:justify-start">
      {children}
    </div>
  );
}
