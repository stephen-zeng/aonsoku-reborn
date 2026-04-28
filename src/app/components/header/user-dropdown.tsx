import { Cast, Info, Keyboard, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AboutDialog } from "@/app/components/about/dialog";
import { RemoteControlDialog } from "@/app/components/remote-control/dialog";
import { ShortcutsDialog } from "@/app/components/shortcuts/dialog";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/app/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { LogoutObserver } from "@/app/observers/logout-observer";
import { ROUTES } from "@/routes/routesList";
import { settingsKeys, shortcutDialogKeys, stringifyShortcut } from "@/shortcuts";
import { useAppData, useAppStore, useAppSettings } from "@/store/app.store";
import { useLanControlServerInfo } from "@/store/lanControl.store";
import { isMacOS } from "@/utils/desktop";

export function UserDropdown() {
  const { username, url, lockUser } = useAppData();
  const setLogoutDialogState = useAppStore(
    (state) => state.actions.setLogoutDialogState,
  );
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setOpenDialog } = useAppSettings();
  const serverInfo = useLanControlServerInfo();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [remoteControlOpen, setRemoteControlOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleSettingsClick() {
    if (isMobile) {
      setDrawerOpen(false);
      navigate(ROUTES.MOBILE.SETTINGS);
    } else {
      setOpenDialog(true);
    }
  }

  useHotkeys("shift+ctrl+q", () => setLogoutDialogState(true));
  useHotkeys("mod+/", () => setShortcutsOpen((prev) => !prev));

  const alignPosition = isMacOS ? "end" : "center";
  const isServerRunning = serverInfo.running;

  return (
    <>
      <LogoutObserver />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <RemoteControlDialog
        open={remoteControlOpen}
        onOpenChange={setRemoteControlOpen}
      />

      {isMobile ? (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger className="user-dropdown-trigger">
            <Avatar className="w-8 h-8 rounded-full cursor-pointer">
              <AvatarFallback className="text-sm bg-transparent hover:bg-accent">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 rounded-full">
                  <AvatarFallback className="text-sm bg-muted">
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1 overflow-hidden">
                  <DrawerTitle className="text-sm font-medium leading-none truncate">
                    {username}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs leading-none truncate">
                    {url}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex flex-col px-4 pb-2">
              {!isServerRunning && (
                <DrawerClose asChild>
                  <button
                    onClick={() => setRemoteControlOpen(true)}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent transition-colors w-full text-left"
                  >
                    <Cast className="h-4 w-4" />
                    <span>{t("lanControl.remote.menu")}</span>
                  </button>
                </DrawerClose>
              )}
              <DrawerClose asChild>
                <button
                  onClick={handleSettingsClick}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent transition-colors w-full text-left"
                >
                  <Settings className="h-4 w-4" />
                  <span>{t("settings.label")}</span>
                </button>
              </DrawerClose>
              <DrawerClose asChild>
                <button
                  onClick={() => setAboutOpen(true)}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-accent transition-colors w-full text-left"
                >
                  <Info className="h-4 w-4" />
                  <span>{t("menu.about")}</span>
                </button>
              </DrawerClose>
            </div>

            {!lockUser && (
              <DrawerFooter className="border-t pt-4">
                <DrawerClose asChild>
                  <button
                    onClick={() => setLogoutDialogState(true)}
                    className="flex items-center justify-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t("menu.serverLogout")}</span>
                  </button>
                </DrawerClose>
              </DrawerFooter>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className="user-dropdown-trigger">
            <Avatar className="w-8 h-8 rounded-full cursor-pointer">
              <AvatarFallback className="text-sm bg-transparent hover:bg-accent">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={alignPosition} className="min-w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-medium leading-none">{username}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {url}
                  </p>
                </div>
                {!lockUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoutDialogState(true);
                    }}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title={t("menu.serverLogout")}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <Keyboard className="mr-2 h-4 w-4" />
              <span>{t("shortcuts.modal.title")}</span>
              <DropdownMenuShortcut>
                {stringifyShortcut(shortcutDialogKeys)}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            {!isServerRunning && (
              <DropdownMenuItem onClick={() => setRemoteControlOpen(true)}>
                <Cast className="mr-2 h-4 w-4" />
                <span>{t("lanControl.remote.menu")}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSettingsClick}>
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("settings.label")}</span>
              <DropdownMenuShortcut>
                {stringifyShortcut(settingsKeys)}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAboutOpen(true)}>
              <Info className="mr-2 h-4 w-4" />
              <span>{t("menu.about")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}