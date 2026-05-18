import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const nativeAudioPluginPath = path.join(
  process.cwd(),
  "capacitor-plugins/capacitor-native/ios/Sources/AonsokuNativePlugin/Audio/AonsokuNativeAudioPlugin.swift",
);

function readNativeAudioPlugin() {
  return readFileSync(nativeAudioPluginPath, "utf-8");
}

describe("iOS native audio source resolution", () => {
  it("resolves WebView media stream URLs before handing sources to AVPlayer", () => {
    const swift = readNativeAudioPlugin();

    expect(swift).toContain("let url = try resolveStreamURL(from: source)");
    expect(swift).toContain('components.scheme == "aonsoku-media"');
    expect(swift).toContain('fallbackSongId: source["songId"] as? String');
    expect(swift).toContain('guard endpoint == "stream"');
    expect(swift).toContain('params["id"] = request.songId');
    expect(swift).toContain('params["estimateContentLength"] = "false"');
  });

  it("preserves optional stream transcoding parameters for native playback", () => {
    const swift = readNativeAudioPlugin();

    expect(swift).toContain('queryItems.first { $0.name == "maxBitRate" }');
    expect(swift).toContain('queryItems.first { $0.name == "format" }');
    expect(swift).toContain('params["maxBitRate"] = maxBitRate');
    expect(swift).toContain('params["format"] = format');
  });
});
