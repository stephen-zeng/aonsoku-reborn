import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { LanControlConfig, LanControlServerInfo } from "@/types/lanControl";
import { decodeStoredPassword, toHex } from "@/utils/salt";

interface ILanControlContext {
  config: LanControlConfig;
  serverInfo: LanControlServerInfo;
  actions: {
    setEnabled: (enabled: boolean) => void;
    setPort: (port: number) => void;
    setPassword: (password: string) => void;
    setAllowNavidromeAuth: (allow: boolean) => void;
    generateRandomPassword: () => string;
    setServerInfo: (info: LanControlServerInfo) => void;
  };
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const DEFAULT_PORT = 5299;

function encodeConfig(config: LanControlConfig) {
  return {
    ...config,
    password: toHex(config.password),
  };
}

function decodeConfig(config: Record<string, unknown>): LanControlConfig {
  const password =
    typeof config.password === "string"
      ? decodeStoredPassword(config.password)
      : "";
  return {
    enabled: typeof config.enabled === "boolean" ? config.enabled : false,
    port: typeof config.port === "number" ? config.port : DEFAULT_PORT,
    password,
    allowNavidromeAuth:
      typeof config.allowNavidromeAuth === "boolean"
        ? config.allowNavidromeAuth
        : true,
  };
}

export const useLanControlStore = createWithEqualityFn<ILanControlContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          config: {
            enabled: false,
            port: DEFAULT_PORT,
            password: generateRandomPassword(),
            allowNavidromeAuth: true,
          },
          serverInfo: {
            running: false,
            port: DEFAULT_PORT,
          },
          actions: {
            setEnabled: (enabled) => {
              set((state) => {
                state.config.enabled = enabled;
              });
            },
            setPort: (port) => {
              set((state) => {
                state.config.port = port;
              });
            },
            setPassword: (password) => {
              set((state) => {
                state.config.password = password.toUpperCase();
              });
            },
            setAllowNavidromeAuth: (allow) => {
              set((state) => {
                state.config.allowNavidromeAuth = allow;
              });
            },
            generateRandomPassword: () => {
              const password = generateRandomPassword();
              set((state) => {
                state.config.password = password;
              });
              return password;
            },
            setServerInfo: (info) => {
              set((state) => {
                state.serverInfo = info;
              });
            },
          },
        })),
        {
          name: "lan_control_store",
        },
      ),
      {
        name: "lan_control_store",
        version: 2,
        partialize: (state) => ({
          config: encodeConfig(state.config),
        }),
        merge: (persisted, current) => {
          const raw = persisted as Record<string, unknown> | null;
          if (!raw) return current;
          const rawConfig = raw.config as Record<string, unknown> | undefined;
          if (!rawConfig) return current;
          return {
            ...current,
            config: decodeConfig(rawConfig),
          };
        },
      },
    ),
  ),
  shallow,
);

export const useLanControlConfig = () =>
  useLanControlStore((state) => state.config);
export const useLanControlServerInfo = () =>
  useLanControlStore((state) => state.serverInfo);
export const useLanControlActions = () =>
  useLanControlStore((state) => state.actions);
