import clsx from "clsx";
import { TimerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import {
  cancelSleepTimer,
  startEndOfTrackTimer,
  startSleepTimer,
} from "@/app/hooks/use-sleep-timer";
import { useSleepTimerStore } from "@/store/sleep-timer.store";

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60];

interface SleepTimerButtonProps {
  disabled?: boolean;
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SleepTimerButton({ disabled }: SleepTimerButtonProps) {
  const { t } = useTranslation();
  const isActive = useSleepTimerStore((s) => s.isActive);
  const mode = useSleepTimerStore((s) => s.mode);
  const remainingSeconds = useSleepTimerStore((s) => s.remainingSeconds);

  return (
    <Popover>
      <SimpleTooltip text={t("player.sleepTimer.tooltip")}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={clsx(
              "rounded-full w-10 h-10 p-2 text-secondary-foreground",
              isActive && "player-button-active",
            )}
            disabled={disabled}
            unfocusable
          >
            <TimerIcon
              className={clsx("w-4 h-4", isActive && "text-primary")}
            />
          </Button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent
        side="top"
        align="center"
        className="w-48 p-2"
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            {t("player.sleepTimer.title")}
          </p>
          {isActive ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm px-2 py-1 text-foreground">
                {mode === "end-of-track"
                  ? t("player.sleepTimer.endOfTrack")
                  : t("player.sleepTimer.remaining", {
                      time: formatRemaining(remainingSeconds),
                    })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={cancelSleepTimer}
              >
                {t("player.sleepTimer.cancel")}
              </Button>
            </div>
          ) : (
            <>
              {PRESET_MINUTES.map((minutes) => (
                <Button
                  key={minutes}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => startSleepTimer(minutes * 60)}
                >
                  {t("player.sleepTimer.minutes", { count: minutes })}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={startEndOfTrackTimer}
              >
                {t("player.sleepTimer.endOfTrack")}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
