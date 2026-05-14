import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useQueueSource } from "@/store/player.store";

interface QueueSourceLabelProps {
  className?: string;
}

export function QueueSourceLabel({ className }: QueueSourceLabelProps) {
  const { t } = useTranslation();
  const queueSource = useQueueSource();

  if (!queueSource) return null;

  return (
    <p
      className={cn("text-xs text-foreground/50 px-2 pb-1 truncate", className)}
    >
      {t("fullscreen.queueFromSource", { source: queueSource })}
    </p>
  );
}
