import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import "@/fonts.css";
import "@/themes.css";
import "@/index.css";
import "@/i18n";

import { MiniPlayer } from "@/app/components/mini-player/player";
import { ExternalMiniPlayerProvider } from "@/app/components/mini-player/provider";
import { appThemes } from "@/app/observers/theme-observer";
import { queryClient } from "@/lib/queryClient";
import { useThemeStore } from "@/store/theme.store";
import { isDarkTheme, Theme, ThemeMode } from "@/types/themeContext";
import { hasElectronBridge } from "@/utils/desktop";
import { setDesktopTitleBarColors, updatePwaThemeColor } from "@/utils/theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove(...appThemes);
  root.classList.add(theme);
  setDesktopTitleBarColors();
  updatePwaThemeColor();
  if (hasElectronBridge()) {
    window.api.setNativeTheme(isDarkTheme(theme));
  }
}

function ThemeInitializer() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const lightTheme = useThemeStore((s) => s.lightTheme);
  const darkTheme = useThemeStore((s) => s.darkTheme);
  const currentTheme = useThemeStore((s) => s.theme);

  useEffect(() => {
    let resolved: Theme;
    switch (themeMode) {
      case ThemeMode.Light:
        resolved = lightTheme;
        break;
      case ThemeMode.Dark:
        resolved = darkTheme;
        break;
      case ThemeMode.System:
      default:
        resolved = getSystemPrefersDark() ? darkTheme : lightTheme;
        break;
    }
    if (resolved !== currentTheme) {
      useThemeStore.getState().setTheme(resolved);
    } else {
      applyTheme(resolved);
    }
  }, [themeMode, lightTheme, darkTheme, currentTheme]);

  return null;
}

export default function MiniPlayerPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <ExternalMiniPlayerProvider>
        <MiniPlayer />
      </ExternalMiniPlayerProvider>
    </QueryClientProvider>
  );
}
