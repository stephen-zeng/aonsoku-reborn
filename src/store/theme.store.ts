import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import {
  IThemeContext,
  isDarkTheme,
  Theme,
  ThemeMode,
} from "@/types/themeContext";
import { createNativeStorage } from "@/store/native-storage";

const VALID_THEMES = new Set<string>(Object.values(Theme));
const VALID_MODES = new Set<string>(Object.values(ThemeMode));

interface ThemePersistedState {
  theme: Theme;
  themeMode: ThemeMode;
  lightTheme: Theme;
  darkTheme: Theme;
}

export const useThemeStore = createWithEqualityFn<IThemeContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          theme: Theme.Dark,
          themeMode: ThemeMode.System,
          lightTheme: Theme.Light,
          darkTheme: Theme.Dark,
          setTheme: (theme: Theme) => {
            set((state) => {
              state.theme = theme;
            });
          },
          setThemeMode: (mode: ThemeMode) => {
            set((state) => {
              state.themeMode = mode;
            });
          },
          setLightTheme: (theme: Theme) => {
            set((state) => {
              state.lightTheme = theme;
            });
          },
          setDarkTheme: (theme: Theme) => {
            set((state) => {
              state.darkTheme = theme;
            });
          },
        })),
        {
          name: "theme_store",
        },
      ),
      {
        name: "theme_store",
        version: 2,
        storage: createNativeStorage<IThemeContext>("theme_store"),
        merge: (persistedState, currentState) => {
          const merged = {
            ...currentState,
            ...persistedState,
          } as ThemePersistedState;
          if (!VALID_MODES.has(merged.themeMode)) {
            const oldTheme = merged.theme;
            if (VALID_THEMES.has(oldTheme) && isDarkTheme(oldTheme)) {
              merged.darkTheme = oldTheme;
            } else if (VALID_THEMES.has(oldTheme)) {
              merged.lightTheme = oldTheme;
            }
            merged.themeMode = ThemeMode.System;
          }
          if (!VALID_THEMES.has(merged.theme)) {
            merged.theme = Theme.Dark;
          }
          if (!VALID_THEMES.has(merged.lightTheme)) {
            merged.lightTheme = Theme.Light;
          }
          if (!VALID_THEMES.has(merged.darkTheme)) {
            merged.darkTheme = Theme.Dark;
          }
          return merged;
        },
      },
    ),
  ),
);

export const useTheme = () => useThemeStore((state) => state);
