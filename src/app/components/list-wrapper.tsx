import { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

type ListWrapperProps = ComponentPropsWithRef<"div">;

export default function ListWrapper({ children, className }: ListWrapperProps) {
  return (
    <div
      className={cn(
        "w-full px-4 py-6 pt-0 bg-transparent relative z-10",
        className,
      )}
      style={{
        paddingLeft: "max(var(--safe-area-left), 1rem)",
        paddingRight: "max(var(--safe-area-right), 1rem)",
      }}
    >
      {children}
    </div>
  );
}
