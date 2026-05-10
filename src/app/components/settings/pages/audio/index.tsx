import { HapticFeedbackSettings } from "./haptic-feedback";
import { HistorySettings } from "./history";
import { LyricsSettings } from "./lyrics";
import { ReplayGainConfig } from "./replay-gain";

export function Audio() {
  return (
    <div className="space-y-4">
      <HapticFeedbackSettings />
      <ReplayGainConfig />
      <LyricsSettings />
      <HistorySettings />
    </div>
  );
}
