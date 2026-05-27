import { describe, expect, it, vi } from "vitest";

// Mock capabilities BEFORE importing useCacheStore so that the initial state loads with capacitor-ios
vi.mock("@/utils/capabilities", () => ({
  getRuntime: () => "capacitor-ios",
}));

import { useCacheStore } from "./cache.store";

describe("useCacheStore on iOS Capacitor", () => {
  it("initializes with libraryCaching and syncLibrary set to true", () => {
    const state = useCacheStore.getState();
    expect(state.settings.libraryCaching).toBe(true);
    expect(state.settings.syncLibrary).toBe(true);
  });

  it("prevents setting libraryCaching and syncLibrary to false", () => {
    useCacheStore.getState().actions.setLibraryCaching(false);
    const state = useCacheStore.getState();
    expect(state.settings.libraryCaching).toBe(true);
    expect(state.settings.syncLibrary).toBe(true);
  });

  it("forces libraryCaching and syncLibrary to true when merging persisted state", () => {
    // Check persist.options.merge behavior
    // biome-ignore lint/suspicious/noExplicitAny: need to access private persist property of Zustand store
    const persist = (useCacheStore as any).persist;
    if (persist && typeof persist.options?.merge === "function") {
      const current = useCacheStore.getState();
      const persisted = {
        settings: {
          libraryCaching: false,
          syncLibrary: false,
        },
      };
      const merged = persist.options.merge(persisted, current);
      expect(merged.settings.libraryCaching).toBe(true);
      expect(merged.settings.syncLibrary).toBe(true);
    }
  });
});
