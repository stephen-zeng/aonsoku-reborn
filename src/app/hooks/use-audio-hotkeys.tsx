import { useRef } from "react";
import { HotkeyCallback, Keys, useHotkeys } from "react-hotkeys-hook";
import { usePlayerStore } from "@/store/player.store";

function hasSpaceKey(keys: Keys): boolean {
  if (keys === "space") return true;
  if (typeof keys === "string") {
    return keys.split(/[+_,]/).includes("space");
  }
  if (Array.isArray(keys)) {
    return keys.some((k) => hasSpaceKey(k));
  }
  return false;
}

function isFocusVisibleActive(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement || activeElement === document.body) return false;

  // Fast path: only interactive elements can have focus-visible
  const tagName = activeElement.tagName;
  if (
    tagName !== "BUTTON" &&
    tagName !== "A" &&
    tagName !== "INPUT" &&
    tagName !== "TEXTAREA" &&
    !(activeElement as HTMLElement).isContentEditable
  ) {
    return false;
  }

  try {
    return activeElement.matches(":focus-visible");
  } catch {
    return false;
  }
}

export function usePlayerHotkeys(options?: { document?: Document }) {
  const hasSongs = usePlayerStore(
    (state) =>
      state.songlist.contextQueue.songs.length > 0 ||
      state.songlist.userQueue.songs.length > 0,
  );

  // Use ref to avoid recreating the function on every render
  const hasSongsRef = useRef(hasSongs);
  hasSongsRef.current = hasSongs;

  const useAudioHotkeys = (keys: Keys, callback: HotkeyCallback) => {
    const isSpaceKey = hasSpaceKey(keys);

    useHotkeys(
      keys,
      (event, handler) => {
        // For spacebar, check if any element has focus-visible (keyboard navigation)
        if (isSpaceKey && isFocusVisibleActive()) {
          // Let the browser handle the spacebar for this focused element
          return;
        }
        event.preventDefault();
        callback(event, handler);
      },
      {
        preventDefault: false,
        enabled: hasSongsRef.current,
        document: options?.document,
      },
    );
  };

  return {
    useAudioHotkeys,
  };
}
