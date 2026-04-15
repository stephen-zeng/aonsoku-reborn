import { TooltipPortal } from "@radix-ui/react-tooltip";
import { ReactNode } from "react";
import { useHasHover } from "@/app/hooks/use-input-mode";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface SimpleTooltipProps {
  children: ReactNode;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "center" | "end" | "start";
  delay?: number;
  avoidCollisions?: boolean;
  disabled?: boolean;
}

export function SimpleTooltip({
  children,
  text,
  side = "top",
  align = "center",
  delay = 700,
  avoidCollisions = true,
  disabled = false,
}: SimpleTooltipProps) {
  const hasHover = useHasHover();

  if (!hasHover || disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={delay}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side={side}
            avoidCollisions={avoidCollisions}
            align={align}
          >
            <p className="font-normal max-w-md text-center">{text}</p>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
