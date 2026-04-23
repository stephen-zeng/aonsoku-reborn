import { useCallback, useLayoutEffect } from "react";
import { useThemeStore } from "@/store/theme.store";
import { Theme, ThemeMode, isDarkTheme } from "@/types/themeContext";
import { isDesktop } from "@/utils/desktop";
import { setDesktopTitleBarColors, updatePwaThemeColor } from "@/utils/theme";

export const appThemes: Theme[] = Object.values(Theme);

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(
  themeMode: ThemeMode,
  lightTheme: Theme,
  darkTheme: Theme,
): Theme {
  switch (themeMode) {
    case ThemeMode.Light:
      return lightTheme;
    case ThemeMode.Dark:
      return darkTheme;
    case ThemeMode.System:
      return getSystemPrefersDark() ? darkTheme : lightTheme;
  }
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove(...appThemes);
  root.classList.add(theme);
  setDesktopTitleBarColors();
  updatePwaThemeColor();

  if (isDesktop()) {
    window.api.setNativeTheme(isDarkTheme(theme));
  }
}

export function ThemeObserver() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const lightTheme = useThemeStore((s) => s.lightTheme);
  const darkTheme = useThemeStore((s) => s.darkTheme);
  const currentTheme = useThemeStore((s) => s.theme);

  const updateTheme = useCallback(() => {
    const resolved = resolveTheme(themeMode, lightTheme, darkTheme);
    if (resolved !== currentTheme) {
      useThemeStore.getState().setTheme(resolved);
    }
  }, [themeMode, lightTheme, darkTheme, currentTheme]);

  useLayoutEffect(() => {
    updateTheme();
  }, [updateTheme]);

  useLayoutEffect(() => {
    if (themeMode !== ThemeMode.System) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = resolveTheme(
        useThemeStore.getState().themeMode,
        useThemeStore.getState().lightTheme,
        useThemeStore.getState().darkTheme,
      );
      const current = useThemeStore.getState().theme;
      if (resolved !== current) {
        useThemeStore.getState().setTheme(resolved);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  useLayoutEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  return null;
}
