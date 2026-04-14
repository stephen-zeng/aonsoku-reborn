import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { MemoFullscreenControls } from "./controls";
import { FullscreenProgress } from "./progress";
import { VolumeBar } from "./volume-bar";

export const FullscreenControlPanel = memo(function FullscreenControlPanel() {
  return (
    <div
      className={`shrink-0 mx-auto w-full ${CONTENT_MAX_WIDTH} flex flex-col justify-between py-5`}
    >
      <div className="px-4">
        <FullscreenProgress thin stacked />
      </div>
      <div className="flex items-center justify-center gap-3">
        <MemoFullscreenControls />
      </div>
      <div className="px-4" data-vaul-no-drag>
        <VolumeBar />
      </div>
    </div>
  );
});
