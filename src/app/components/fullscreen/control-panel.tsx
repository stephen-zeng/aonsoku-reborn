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
  return (
    <div
      className={clsx(
        "mx-auto self-center w-full flex flex-col",
        CONTENT_MAX_WIDTH,
        compact
          ? "shrink-0 gap-3 pb-2"
          : expanded
            ? "shrink-0 pt-2 pb-6 gap-6 md:gap-8"
            : "shrink-0 py-7 gap-5",
      )}
    >
      <div
        className={clsx(compact ? "shrink-0 px-4" : "px-0")}
      >
        <FullscreenProgress thin stacked />
      </div>
      <div
        className={clsx(
          "flex items-center justify-center",
          compact
            ? "shrink-0 gap-4"
            : expanded
              ? "gap-8 md:gap-10"
              : "gap-6 md:gap-3",
        )}
      >
        <MemoFullscreenControls />
      </div>
      <div
        className={clsx(compact ? "shrink-0 px-4" : "px-0")}
        data-vaul-no-drag
      >
        <VolumeBar />
      </div>
    </div>
  );
});
