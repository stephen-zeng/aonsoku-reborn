import { describe, expect, it, vi } from "vitest";
import { TauriAudioPlaybackBackend } from "./tauri-backend";

type TauriDesktopAudioEvent = {
  type: "progress";
  currentTime?: number;
  duration?: number;
  bufferedTime?: number;
};

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => {}),
  unlisten: vi.fn(),
  eventHandler: null as
    | ((event: { payload: TauriDesktopAudioEvent }) => void)
    | null,
}));

vi.mock("@/utils/desktop", () => ({
  hasTauriBridge: () => true,
}));

vi.mock("@/utils/tauri", () => ({
  getTauriInvoke: () => mocks.invoke,
  listenTauriEvent: vi.fn(
    async (
      _event: string,
      handler: (event: { payload: TauriDesktopAudioEvent }) => void,
    ) => {
      mocks.eventHandler = handler;
      return mocks.unlisten;
    },
  ),
}));

function emitTauriProgress(event: Omit<TauriDesktopAudioEvent, "type">) {
  mocks.eventHandler?.({
    payload: {
      type: "progress",
      ...event,
    },
  });
}

describe("TauriAudioPlaybackBackend", () => {
  it("suppresses stale progress events while a seek is pending", async () => {
    const backend = new TauriAudioPlaybackBackend();
    const progress = vi.fn();
    backend.subscribe("progress", progress);

    await backend.seek(120);
    emitTauriProgress({ currentTime: 40, duration: 240, bufferedTime: 180 });
    emitTauriProgress({ currentTime: 120.2, duration: 240, bufferedTime: 180 });

    expect(mocks.invoke).toHaveBeenCalledWith("desktop_audio_seek", {
      payload: { position: 120 },
    });
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith({
      currentTime: 120.2,
      duration: 240,
      bufferedTime: 180,
    });
  });
});
