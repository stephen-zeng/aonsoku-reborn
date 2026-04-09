import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useIsOffline } from "@/store/offline.store";
import { usePlaylists } from "@/store/playlists.store";

export function SidebarPlaylistButtons() {
  const { setPlaylistDialogState } = usePlaylists();
  const { t } = useTranslation();
  const isOfflineMode = useIsOffline();

  return (
    <div className="flex items-center gap-2">
      <SimpleTooltip text={t("playlist.form.create.title")}>
        <Button
          size="icon"
          variant="ghost"
          className="w-6 h-6 p-[5px]"
          disabled={isOfflineMode}
          onClick={() => setPlaylistDialogState(true)}
        >
          <PlusIcon strokeWidth={3} />
        </Button>
      </SimpleTooltip>
    </div>
  );
}
