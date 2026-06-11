import { clsx } from "clsx";
import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { MemoFullscreenControls } from "./controls";
import { FullscreenProgress } from "./progress";
import { VolumeBar } from "./volume-bar";

export const FullscreenControlPanel = memo(function FullscreenControlPanel({
  expanded = false,
  compact = false,
}: {
  expanded?: boolean;
  compact?: boolean;
}) {
  const contentPaddingClass = compact ? "px-4" : "px-0";

  return (
    <div
      className={clsx(
        "mx-auto self-center w-full flex flex-col transition-all duration-300 ease-in-out",
        CONTENT_MAX_WIDTH,
        "shrink-0 gap-3 pb-2",
        // compact
        //   ? "shrink-0 gap-3 pb-2"
        //   : expanded
        //     ? "shrink-0 pt-7 pb-6 gap-6 md:gap-8"
        //     : "shrink-0 py-7 gap-5",
      )}
    >
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          compact && "shrink-0",
          contentPaddingClass,
        )}
      >
        <FullscreenProgress thin stacked />
      </div>
      <div
        className={clsx(
          "flex min-h-14 items-center justify-between transition-all duration-300 ease-in-out",
          compact ? "shrink-0" : expanded ? "" : "md:justify-center md:gap-3",
          contentPaddingClass,
        )}
      >
        <MemoFullscreenControls />
      </div>
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          compact && "shrink-0",
          contentPaddingClass,
        )}
        data-vaul-no-drag
      >
        <VolumeBar />
      </div>
    </div>
  );
});
