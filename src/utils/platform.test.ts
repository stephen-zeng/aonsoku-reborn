import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("platform detection", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      delete (globalThis as Record<string, unknown>).document;
    }
  });

  async function importPlatform() {
    return import("@/utils/platform");
  }

  describe("isIOS", () => {
    it("returns true for iPhone platform", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "iPhone",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(true);
    });

    it("returns true for iPad platform", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "iPad",
          userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(true);
    });

    it("returns true for iPod platform", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "iPod",
          userAgent:
            "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(true);
    });

    it("returns true for iPhone user agent", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(true);
    });

    it("returns true for iPad user agent on iOS 13+", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        },
      });
      vi.stubGlobal("document", { ontouchend: () => {} });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(true);
    });

    it("returns false for Windows platform", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "Win32",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(false);
    });

    it("returns false for Mac platform without touch", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      vi.stubGlobal("document", {});
      const { isIOS } = await importPlatform();
      expect(isIOS()).toBe(false);
    });
  });

  describe("isIPad", () => {
    it("returns true for iPad platform", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "iPad",
          userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIPad } = await importPlatform();
      expect(isIPad()).toBe(true);
    });

    it("returns true for Mac with touch (iPad iOS 13+)", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
      });
      vi.stubGlobal("document", { ontouchend: () => {} });
      const { isIPad } = await importPlatform();
      expect(isIPad()).toBe(true);
    });

    it("returns false for iPhone", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "iPhone",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIPad } = await importPlatform();
      expect(isIPad()).toBe(false);
    });

    it("returns false for Windows", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "Win32",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isIPad } = await importPlatform();
      expect(isIPad()).toBe(false);
    });
  });

  describe("isAndroid", () => {
    it("returns true for Android user agent", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "Linux armv7l",
          userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isAndroid } = await importPlatform();
      expect(isAndroid()).toBe(true);
    });

    it("returns false for non-Android user agent", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "Win32",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isAndroid } = await importPlatform();
      expect(isAndroid()).toBe(false);
    });
  });

  describe("isSafari", () => {
    it("returns true for Safari user agent without Chrome", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isSafari } = await importPlatform();
      expect(isSafari()).toBe(true);
    });

    it("returns false for Chrome user agent", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isSafari } = await importPlatform();
      expect(isSafari()).toBe(false);
    });

    it("returns false for Firefox user agent", async () => {
      vi.stubGlobal("window", {
        navigator: {
          platform: "MacIntel",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
        },
      });
      vi.stubGlobal("document", { ontouchend: undefined });
      const { isSafari } = await importPlatform();
      expect(isSafari()).toBe(false);
    });
  });
});
