import { useMemo } from "react";
import { usePlayerStore } from "@/store/player.store";
import { useTheme } from "@/store/theme.store";
import { blendColors, hslToHex, isDarkHex } from "@/utils/getAverageColor";

const DARK_STYLE: React.CSSProperties = {
  "--foreground": "0 0% 100%",
  "--secondary-foreground": "0 0% 100%",
  "--muted-foreground": "0 0% 70%",
  "--fullscreen-active-color": "#ffffff",
  "--accent": "0 0% 100% / 15%",
  "--accent-foreground": "0 0% 100%",
  "--muted": "0 0% 100% / 10%",
  "--border": "0 0% 100% / 15%",
  "--btn-text-inv": "#000000",
};

const LIGHT_STYLE: React.CSSProperties = {
  "--foreground": "224 10% 15%",
  "--secondary-foreground": "220.9 39.3% 11%",
  "--muted-foreground": "220 8.9% 46.1%",
  "--primary": "161 94% 30%",
  "--fullscreen-active-color": "hsl(var(--primary))",
  "--accent": "220 14.3% 90%",
  "--accent-foreground": "224 10% 15%",
  "--muted": "220 14.3% 95.9%",
  "--border": "220 13% 91%",
  "--btn-text-inv": "#ffffff",
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
      className: isDark ? "backdrop-dark" : "backdrop-light",
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
      playButtonBg: isDark ? "bg-white" : "bg-foreground",
      playButtonIconColor: isDark ? "text-black" : "text-white",
      playButtonIconFill: isDark ? "fill-black" : "fill-white",
      style: isDark ? DARK_STYLE : LIGHT_STYLE,
    };
  }, [currentSongColor, currentSongColorIntensity, theme]);
}
