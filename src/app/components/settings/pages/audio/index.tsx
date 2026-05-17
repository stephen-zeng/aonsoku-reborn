import { HapticFeedbackSettings } from "./haptic-feedback";
import { HistorySettings } from "./history";
import { LyricsSettings } from "./lyrics";
import { PipSettings } from "./pip-settings";
import { ReplayGainConfig } from "./replay-gain";

export function Audio() {
  return (
    <div className="space-y-4">
      <HapticFeedbackSettings />
      <PipSettings />
      <ReplayGainConfig />
      <LyricsSettings />
      <HistorySettings />
    </div>
  );
}
