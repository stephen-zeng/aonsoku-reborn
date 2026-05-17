import { useMemo } from "react";
import { usePlayerStore } from "@/store/player.store";
import { useTheme } from "@/store/theme.store";
import { blendColors, hslToHex, isDarkHex } from "@/utils/getAverageColor";

const DARK_STYLE: React.CSSProperties = {
  "--foreground": "0 0% 100%",
  "--secondary-foreground": "0 0% 100%",
  "--muted-foreground": "0 0% 70%",
  "--fullscreen-active-color": "#ffffff",
};

const LIGHT_STYLE: React.CSSProperties = {
  "--fullscreen-active-color": "hsl(var(--primary))",
};

export function useFullscreenContrast() {
  const currentSongColor = usePlayerStore(
    (s) => s.settings.colors.currentSongColor,
  );
  const currentSongColorIntensity = usePlayerStore(
    (s) => s.settings.colors.currentSongColorIntensity,
  );
  const { theme } = useTheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: theme changes --background which is read via getComputedStyle
  return useMemo(() => {
    const bgHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    const baseHex = hslToHex(bgHsl);

    const blendedColor = currentSongColor
      ? blendColors(baseHex, currentSongColor, currentSongColorIntensity)
      : baseHex;

    const isDark = isDarkHex(blendedColor);

    return {
      isBackdropDark: isDark,
      hoverBg: isDark
        ? "hover-supported:bg-white/20"
        : "hover-supported:bg-foreground/20",
      hoverBg10: isDark
        ? "hover-supported:bg-white/10"
        : "hover-supported:bg-foreground/10",
      sliderTrackColor: isDark ? "bg-white/30" : "bg-muted-foreground/70",
      sliderRangeColor: isDark ? "bg-white" : "bg-secondary-foreground",
      sliderThumbColor: isDark
        ? "bg-white border-white"
        : "bg-secondary-foreground border-secondary-foreground",
      playButtonBg: isDark ? "bg-white" : "bg-secondary-foreground",
      playButtonIcon: isDark
        ? "text-black fill-black"
        : "text-secondary fill-secondary",
      style: isDark ? DARK_STYLE : LIGHT_STYLE,
    };
  }, [currentSongColor, currentSongColorIntensity, theme]);
}
