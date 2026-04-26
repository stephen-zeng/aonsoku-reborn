import { useTranslation } from "react-i18next";
import { usePlayerCurrentList } from "@/store/player.store";
import { QueueSourceLabel } from "./queue-source-label";
import { DraggableVirtualQueue } from "./draggable-virtual-queue";

export function QueueSongList() {
  const { t } = useTranslation();
  const currentList = usePlayerCurrentList();

  if (currentList.length === 0) {
    return (
      <div className="flex flex-1 flex-col h-full min-w-0 items-center justify-center">
        <span>{t("fullscreen.emptyQueue")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full min-w-0">
      <QueueSourceLabel />
      <DraggableVirtualQueue />
    </div>
  );
}
