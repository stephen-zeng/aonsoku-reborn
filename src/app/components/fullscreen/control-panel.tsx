import { clsx } from "clsx";
import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { MemoFullscreenControls } from "./controls";
import { FullscreenProgress } from "./progress";
import { VolumeBar } from "./volume-bar";

export const FullscreenControlPanel = memo(function FullscreenControlPanel({
  expanded = false,
  compact = false,
  className,
}: {
  expanded?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "mx-auto self-center w-full flex flex-col transition-all duration-300 ease-in-out min-h-0",
        CONTENT_MAX_WIDTH,
        compact
          ? "shrink-0 gap-3 pb-2"
          : expanded
            ? "flex-1 justify-between pt-4 pb-6 min-h-0"
            : "shrink-0 py-7 gap-5",
        className,
      )}
    >
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          compact && "shrink-0",
        )}
      >
        <FullscreenProgress thin stacked />
      </div>
      <div
        className={clsx(
          "flex min-h-14 items-center justify-between transition-all duration-300 ease-in-out",
          compact
            ? "shrink-0"
            : expanded
              ? ""
              : "md:justify-center md:gap-3",
        )}
      >
        <MemoFullscreenControls />
      </div>
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          compact && "shrink-0",
        )}
        data-vaul-no-drag
      >
        <VolumeBar />
      </div>
    </div>
  );
});
