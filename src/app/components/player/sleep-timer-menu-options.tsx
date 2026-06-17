import { TimerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  cancelSleepTimer,
  startEndOfTrackTimer,
  startSleepTimer,
} from "@/app/hooks/use-sleep-timer";
import { useSleepTimerStore } from "@/store/sleep-timer.store";

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60];

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SleepTimerMenuOptions() {
  const { t } = useTranslation();
  const isActive = useSleepTimerStore((s) => s.isActive);
  const mode = useSleepTimerStore((s) => s.mode);
  const remainingSeconds = useSleepTimerStore((s) => s.remainingSeconds);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <TimerIcon className="mr-2 h-4 w-4" />
        <span>{t("player.sleepTimer.title")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        {isActive ? (
          <>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {mode === "end-of-track"
                ? t("player.sleepTimer.endOfTrack")
                : t("player.sleepTimer.remaining", {
                    time: formatRemaining(remainingSeconds),
                  })}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus-visible:text-destructive hover-supported:text-destructive"
              onClick={cancelSleepTimer}
            >
              {t("player.sleepTimer.cancel")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {PRESET_MINUTES.map((minutes) => (
              <DropdownMenuItem
                key={minutes}
                onClick={() => startSleepTimer(minutes * 60)}
              >
                {t("player.sleepTimer.minutes", { count: minutes })}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={startEndOfTrackTimer}>
              {t("player.sleepTimer.endOfTrack")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
