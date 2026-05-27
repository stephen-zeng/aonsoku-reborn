import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useCallback } from "react";
import { useWebHaptics } from "web-haptics/react";
import { useHapticSettings } from "@/store/player.store";

type HapticStyle = "light" | "medium" | "heavy";

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const styleMap = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

const durationMap: Record<HapticStyle, number> = {
  light: 1,
  medium: 4,
  heavy: 6,
};

export function useHaptic() {
  const { hapticFeedbackEnabled } = useHapticSettings();
  const { trigger: webTrigger } = useWebHaptics();

  const trigger = useCallback(
    (style: HapticStyle = "light") => {
      if (isNativeIOS) {
        Haptics.impact({ style: styleMap[style] });
      } else {
        webTrigger([{ duration: durationMap[style] }]);
      }
    },
    [webTrigger],
  );

  return { trigger: hapticFeedbackEnabled ? trigger : undefined };
}
