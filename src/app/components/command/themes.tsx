import { useTranslation } from "react-i18next";
import {
  ThemePlaceholder,
  ThemeTitle,
} from "@/app/components/settings/pages/appearance/theme";
import { CommandGroup, CommandItem } from "@/app/components/ui/command";
import { useTheme } from "@/store/theme.store";
import {
  ThemeMode,
  getThemeGroupForMode,
  themeGroups,
  themeModeItems,
} from "@/types/themeContext";
import { CommandItemProps } from "./command-menu";

export function CommandThemes({ runCommand }: CommandItemProps) {
  const { t } = useTranslation();
  const {
    themeMode,
    lightTheme,
    darkTheme,
    setThemeMode,
    setLightTheme,
    setDarkTheme,
  } = useTheme();

  return (
    <>
      <CommandGroup heading={t("theme.modeLabel")}>
        <div className="flex gap-1 p-1">
          {themeModeItems.map(({ value, labelKey, icon: Icon }) => (
            <CommandItem
              key={value}
              onSelect={() => runCommand(() => setThemeMode(value))}
              disabled={themeMode === value}
              className="flex-1 justify-center"
            >
              <Icon size={14} />
              <span className="text-xs">{t(labelKey)}</span>
            </CommandItem>
          ))}
        </div>
      </CommandGroup>
      {themeMode === ThemeMode.System ? (
        themeGroups.map((group) => (
          <CommandGroup key={group.key} heading={t(group.label)}>
            <div className="grid grid-cols-4">
              {group.themes.map((theme) => {
                const activeTheme =
                  group.key === "light" ? lightTheme : darkTheme;
                const onThemeChange =
                  group.key === "light" ? setLightTheme : setDarkTheme;
                return (
                  <CommandItem
                    key={`${group.key}-${theme}`}
                    onSelect={() => runCommand(() => onThemeChange(theme))}
                    disabled={theme === activeTheme}
                  >
                    <div className="w-full h-full">
                      <ThemePlaceholder theme={theme} />
                      <ThemeTitle
                        theme={theme}
                        isActive={theme === activeTheme}
                      />
                    </div>
                  </CommandItem>
                );
              })}
            </div>
          </CommandGroup>
        ))
      ) : (
        <CommandGroup
          heading={
            themeMode === ThemeMode.Light
              ? t("theme.modeLight")
              : t("theme.modeDark")
          }
        >
          <div className="grid grid-cols-4">
            {getThemeGroupForMode(themeMode).themes.map((theme) => {
              const activeTheme =
                themeMode === ThemeMode.Light ? lightTheme : darkTheme;
              const onThemeChange =
                themeMode === ThemeMode.Light ? setLightTheme : setDarkTheme;
              return (
                <CommandItem
                  key={theme}
                  onSelect={() => runCommand(() => onThemeChange(theme))}
                  disabled={theme === activeTheme}
                >
                  <div className="w-full h-full">
                    <ThemePlaceholder theme={theme} />
                    <ThemeTitle
                      theme={theme}
                      isActive={theme === activeTheme}
                    />
                  </div>
                </CommandItem>
              );
            })}
          </div>
        </CommandGroup>
      )}
    </>
  );
}
