import clsx from "clsx";
import { Check, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContentItemTitle } from "@/app/components/settings/section";
import { useTheme } from "@/store/theme.store";
import {
  darkThemes,
  lightThemes,
  Theme,
  ThemeMode,
  themeGroups,
  themeModeItems,
} from "@/types/themeContext";
import { Switch } from "@/app/components/ui/switch";
import { getRuntime } from "@/utils/capabilities";

export function ThemeSettingsPicker() {
  const { t } = useTranslation();
  const {
    themeMode,
    lightTheme,
    darkTheme,
    materialYouEnabled,
    setThemeMode,
    setLightTheme,
    setDarkTheme,
    setMaterialYouEnabled,
  } = useTheme();

  const isAndroidApp = getRuntime() === "capacitor-android";

  return (
    <div className="h-full space-y-4">
      <ContentItemTitle>{t("theme.label")}</ContentItemTitle>
      <ThemeModeSelector mode={themeMode} onModeChange={setThemeMode} />

      {isAndroidApp && (
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-card/30">
          <div className="space-y-0.5 pr-4">
            <p className="text-sm font-medium">{t("theme.materialYou")}</p>
            <p className="text-xs text-muted-foreground">
              {t("theme.materialYouInfo")}
            </p>
          </div>
          <Switch
            checked={materialYouEnabled}
            onCheckedChange={setMaterialYouEnabled}
          />
        </div>
      )}

      {(!isAndroidApp || !materialYouEnabled) && (
        <>
          {themeMode === ThemeMode.System ? (
            <div className="space-y-4">
              {themeGroups.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t(group.label)}
                  </p>
                  <ThemeGrid
                    themes={group.themes}
                    activeTheme={group.key === "light" ? lightTheme : darkTheme}
                    onThemeChange={
                      group.key === "light" ? setLightTheme : setDarkTheme
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <ThemeGrid
              themes={themeMode === ThemeMode.Light ? lightThemes : darkThemes}
              activeTheme={
                themeMode === ThemeMode.Light ? lightTheme : darkTheme
              }
              onThemeChange={
                themeMode === ThemeMode.Light ? setLightTheme : setDarkTheme
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ThemeModeSelector({
  mode,
  onModeChange,
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid w-full grid-cols-3 rounded-lg border border-border p-0.5 gap-0.5 sm:inline-flex sm:w-auto">
      {themeModeItems.map(({ value, labelKey, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onModeChange(value)}
          className={clsx(
            "inline-flex min-h-11 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md sm:min-h-8",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover-supported:text-foreground hover-supported:bg-muted",
          )}
        >
          <Icon size={14} />
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

function ThemeGrid({
  themes,
  activeTheme,
  onThemeChange,
}: {
  themes: Theme[];
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  return (
    <div className="w-full h-full grid grid-cols-2 gap-3 sm:grid-cols-4">
      {themes.map((theme) => {
        const isActive = theme === activeTheme;

        return (
          <button
            key={theme}
            type="button"
            className="text-left"
            onClick={() => onThemeChange(theme)}
          >
            <ThemePlaceholder theme={theme} />
            <ThemeTitle theme={theme} isActive={isActive} />
          </button>
        );
      })}
    </div>
  );
}

export function ThemePlaceholder({ theme }: { theme: Theme }) {
  return (
    <div className={theme}>
      <div className="bg-background aspect-square border border-border rounded overflow-hidden flex cursor-pointer">
        <div className="w-1/3 h-full bg-background border-r border-border flex flex-col p-1 gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full h-1/5 bg-accent rounded-[2px]" />
          ))}
        </div>
        <div className="w-full h-full bg-background-foreground flex flex-col gap-1 p-1 *:w-full *:h-1/4 *:rounded-[2px]">
          <div className="bg-accent" />
          <div className="bg-primary" />
          <div className="bg-muted" />
          <div className="bg-secondary" />
        </div>
      </div>
    </div>
  );
}

type ThemeTitleProps = {
  isActive: boolean;
  theme: Theme;
};

export function ThemeTitle({ isActive, theme }: ThemeTitleProps) {
  const { t } = useTranslation();

  return (
    <span
      className={clsx(
        "mt-2 flex items-center gap-1",
        !isActive && "text-muted-foreground/70",
      )}
    >
      <Check
        size={16}
        strokeWidth={2}
        className={clsx(!isActive && "hidden")}
        aria-hidden="true"
      />
      <Minus
        size={16}
        strokeWidth={2}
        className={clsx(isActive && "hidden")}
        aria-hidden="true"
      />
      <span className="text-xs font-medium">{t(`theme.${theme}`)}</span>
    </span>
  );
}
