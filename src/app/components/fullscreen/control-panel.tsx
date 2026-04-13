import { memo } from "react";
import { CONTENT_MAX_WIDTH } from "./constants";
import { FullscreenControls } from "./controls";
import { LikeButton } from "./like-button";
import { MobileVolumeBar } from "./mobile-volume-bar";
import { FullscreenProgress } from "./progress";
import { VolumeContainer } from "./volume-container";

type ControlPanelVariant = "desktop" | "mobile" | "mobile-secondary";

interface ControlPanelProps {
  variant: ControlPanelVariant;
}

export const FullscreenControlPanel = memo(function FullscreenControlPanel({
  variant,
}: ControlPanelProps) {
  if (variant === "desktop") {
    return (
      <div
        className={`flex flex-col gap-3 pb-2 mx-auto w-full ${CONTENT_MAX_WIDTH}`}
      >
        <FullscreenProgress />
        <div className="flex items-center justify-center">
          <FullscreenControls />
        </div>
        <div className="flex items-center justify-center">
          <VolumeContainer />
        </div>
      </div>
    );
  }

  if (variant === "mobile") {
    return (
      <div
        className={`flex-1 min-h-0 mx-auto w-full ${CONTENT_MAX_WIDTH} flex flex-col justify-between py-5`}
      >
        <div className="px-4">
          <FullscreenProgress thin stacked />
        </div>
        <div className="flex items-center justify-center gap-3">
          <FullscreenControls />
        </div>
        <div className="px-4" data-vaul-no-drag>
          <MobileVolumeBar />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="shrink-0 px-4 py-1">
        <FullscreenProgress />
      </div>
      <div className="shrink-0 flex items-center justify-center gap-1 py-1">
        <LikeButton />
        <FullscreenControls />
      </div>
    </>
  );
});
