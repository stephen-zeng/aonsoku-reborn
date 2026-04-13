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
      <div className={`shrink-0 mx-auto w-full ${CONTENT_MAX_WIDTH}`}>
        <div className="px-4 pt-2">
          <FullscreenProgress thin />
        </div>
        <div className="flex items-center justify-center gap-1 pt-1">
          <FullscreenControls />
        </div>
        <div className="px-4 pt-1 pb-1">
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
