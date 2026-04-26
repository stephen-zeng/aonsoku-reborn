import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends ComponentPropsWithoutRef<"div"> {
  value?: number;
}

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, value))}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-in-out"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
        }}
      />
    </div>
  );
}
