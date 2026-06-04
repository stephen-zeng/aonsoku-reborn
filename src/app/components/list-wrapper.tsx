import { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

type ListWrapperProps = ComponentPropsWithRef<"div">;

export default function ListWrapper({ children, className }: ListWrapperProps) {
  return (
    <div
      className={cn(
        "w-full py-6 pt-0 bg-transparent relative z-10 px-content-area",
        className,
      )}
    >
      {children}
    </div>
  );
}
