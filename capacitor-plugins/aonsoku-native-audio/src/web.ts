import { WebPlugin } from "@capacitor/core";
import type {
  MediaMetadataOptions,
  NativeAudioPlugin,
  PlaybackState,
  ReplayGainOptions,
  SeekOptions,
  SetSrcOptions,
  VolumeOptions,
} from "./definitions";

export class NativeAudioWeb extends WebPlugin implements NativeAudioPlugin {
  async setSrc(_options: SetSrcOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async play(): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async pause(): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async seek(_options: SeekOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async stop(): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async setVolume(_options: VolumeOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async setReplayGain(_options: ReplayGainOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async getState(): Promise<PlaybackState> {
    throw this.unimplemented("Not implemented on web");
  }

  async setMediaMetadata(_options: MediaMetadataOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }

  async preload(_options: SetSrcOptions): Promise<void> {
    throw this.unimplemented("Not implemented on web");
  }
}
