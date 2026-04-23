import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthType } from "@/types/serverConfig";
import { canUseConfiguredSession } from "./configuredSession";

const mocks = vi.hoisted(() => ({
  selectConfiguredServer: vi.fn(),
  probeServerConnection: vi.fn(),
  appData: {} as Record<string, unknown>,
}));

vi.mock("@/api/checkConfiguredServer", () => ({
  checkConfiguredServerConnectivity: mocks.selectConfiguredServer,
}));

vi.mock("@/api/pingServer", () => ({
  probeServerConnection: mocks.probeServerConnection,
}));

vi.mock("@/store/app.store", () => ({
  useAppStore: {
    getState: () => ({
      data: mocks.appData,
    }),
  },
}));

vi.mock("@/app/hooks/use-network-status", () => ({
  getConfiguredUrls: () => {
    const { primaryUrl, fallbackUrl, url } = mocks.appData;
    return Array.from(new Set([primaryUrl, fallbackUrl, url].filter(Boolean)));
  },
}));

beforeEach(() => {
  mocks.appData = {
    primaryUrl: "https://primary.example",
    fallbackUrl: "",
    url: "https://primary.example",
    username: "demo",
    password: "token",
    authType: AuthType.TOKEN,
    isServerConfigured: true,
  };

  mocks.selectConfiguredServer.mockReset();
  mocks.probeServerConnection.mockReset();
});

describe("canUseConfiguredSession", () => {
  it("allows temporary server reachability failures without clearing the session", async () => {
    mocks.probeServerConnection.mockResolvedValue({
      status: "network_unreachable",
    });

    await expect(canUseConfiguredSession()).resolves.toBe(true);

    expect(mocks.probeServerConnection).toHaveBeenCalledTimes(1);
    expect(mocks.selectConfiguredServer).not.toHaveBeenCalled();
  });

  it("allows the session when probeServerConnection throws", async () => {
    mocks.probeServerConnection.mockRejectedValue(new Error("Network error"));

    await expect(canUseConfiguredSession()).resolves.toBe(true);

    expect(mocks.probeServerConnection).toHaveBeenCalledTimes(1);
    expect(mocks.selectConfiguredServer).not.toHaveBeenCalled();
  });

  it("refreshes the selected server when a configured endpoint is reachable", async () => {
    mocks.appData.fallbackUrl = "https://fallback.example";
    mocks.probeServerConnection
      .mockResolvedValueOnce({ status: "network_unreachable" })
      .mockResolvedValueOnce({ status: "ok" });
    mocks.selectConfiguredServer.mockResolvedValue(true);

    await expect(canUseConfiguredSession()).resolves.toBe(true);

    expect(mocks.probeServerConnection).toHaveBeenCalledTimes(2);
    expect(mocks.selectConfiguredServer).toHaveBeenCalledTimes(1);
  });

  it("rejects the session only when all configured endpoints fail auth", async () => {
    mocks.appData.fallbackUrl = "https://fallback.example";
    mocks.probeServerConnection.mockResolvedValue({
      status: "auth_failed",
    });

    await expect(canUseConfiguredSession()).resolves.toBe(false);

    expect(mocks.probeServerConnection).toHaveBeenCalledTimes(2);
    expect(mocks.selectConfiguredServer).not.toHaveBeenCalled();
  });
});
