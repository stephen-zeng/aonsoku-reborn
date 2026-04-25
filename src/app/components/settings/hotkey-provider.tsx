import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { ROUTES } from "@/routes/routesList";
import { useAppSettings } from "@/store/app.store";

export function SettingsHotkeyProvider() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { setOpenDialog } = useAppSettings();

  useHotkeys(
    "mod+comma",
    (e) => {
      e.preventDefault();
      if (isMobile) {
        navigate(ROUTES.MOBILE.SETTINGS);
      } else {
        setOpenDialog(true);
      }
    },
    { preventDefault: true },
  );

  return null;
}
