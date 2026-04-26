import merge from "lodash/merge";
import omit from "lodash/omit";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { pingServer } from "@/api/pingServer";
import { queryServerInfo } from "@/api/queryServerInfo";
import {
  ActiveServerType,
  AuthType,
  IAppContext,
  IServerConfig,
  IServerUrlConfig,
} from "@/types/serverConfig";
import { isDesktop } from "@/utils/desktop";
import { discordRpc } from "@/utils/discordRpc";
import { logger } from "@/utils/logger";
import { isValidServerUrl, normalizeServerUrl } from "@/utils/serverUrl";
import {
  genEncodedPassword,
  genPassword,
  genPasswordToken,
  genUser,
  getAuthType,
  hasValidConfig,
} from "@/utils/salt";

const { SERVER_URL, HIDE_SERVER, HIDE_RADIOS_SECTION, SERVER_TYPE } = window;

async function getServerInfoWithOverride(
  url: string,
  fallbackServerType = "subsonic",
) {
  try {
    const serverInfo = await queryServerInfo(url);

    return {
      protocolVersion: serverInfo.protocolVersion,
      serverType: SERVER_TYPE ?? serverInfo.serverType,
    };
  } catch (_error) {
    return {
      protocolVersion: "1.16.0",
      serverType: SERVER_TYPE ?? fallbackServerType,
    };
  }
}

interface NormalizedServerUrls {
  primaryUrl: string;
  fallbackUrl: string;
}

interface ResolvedServerSelection extends NormalizedServerUrls {
  activeUrl: string;
  activeServerType: NonNullable<ActiveServerType>;
  protocolVersion: string;
  serverType: string;
}

function normalizeConfiguredServerUrls(primaryUrl: string, fallbackUrl = "") {
  const normalizedPrimaryUrl = normalizeServerUrl(primaryUrl);
  const normalizedFallbackUrl = normalizeServerUrl(fallbackUrl);

  return {
    primaryUrl: normalizedPrimaryUrl,
    fallbackUrl: isValidServerUrl(normalizedFallbackUrl)
      ? normalizedFallbackUrl
      : "",
  };
}

function applyConfiguredServerState(
  data: IAppContext["data"],
  {
    primaryUrl,
    fallbackUrl,
    activeUrl,
    activeServerType,
    protocolVersion,
    serverType,
  }: ResolvedServerSelection,
) {
  data.url = activeUrl;
  data.primaryUrl = primaryUrl;
  data.fallbackUrl = fallbackUrl;
  data.activeServerType = activeServerType;
  data.protocolVersion = protocolVersion;
  data.serverType = serverType;
  data.isServerConfigured = true;
}

async function resolveConfiguredServer({
  primaryUrl,
  fallbackUrl,
  username,
  password,
  authType,
  serverType,
}: {
  primaryUrl: string;
  fallbackUrl?: string;
  username: string;
  password: string;
  authType: AuthType;
  serverType?: string;
}): Promise<ResolvedServerSelection | null> {
  const normalizedUrls = normalizeConfiguredServerUrls(primaryUrl, fallbackUrl);

  if (!isValidServerUrl(normalizedUrls.primaryUrl)) {
    return null;
  }

  const primaryCanConnect = await pingServer(
    normalizedUrls.primaryUrl,
    username,
    password,
    authType,
  );

  if (primaryCanConnect) {
    const serverInfo = await getServerInfoWithOverride(
      normalizedUrls.primaryUrl,
      serverType,
    );

    return {
      ...normalizedUrls,
      activeUrl: normalizedUrls.primaryUrl,
      activeServerType: "primary",
      protocolVersion: serverInfo.protocolVersion,
      serverType: serverInfo.serverType,
    };
  }

  if (!normalizedUrls.fallbackUrl) {
    return null;
  }

  const fallbackCanConnect = await pingServer(
    normalizedUrls.fallbackUrl,
    username,
    password,
    authType,
  );

  if (!fallbackCanConnect) {
    return null;
  }

  const serverInfo = await getServerInfoWithOverride(
    normalizedUrls.fallbackUrl,
    serverType,
  );

  return {
    ...normalizedUrls,
    activeUrl: normalizedUrls.fallbackUrl,
    activeServerType: "fallback",
    protocolVersion: serverInfo.protocolVersion,
    serverType: serverInfo.serverType,
  };
}

export const useAppStore = createWithEqualityFn<IAppContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set, get) => ({
          data: {
            isServerConfigured: hasValidConfig,
            osType: "",
            url: SERVER_URL ?? "",
            primaryUrl: SERVER_URL ?? "",
            fallbackUrl: "",
            activeServerType: SERVER_URL ? "primary" : null,
            username: genUser(),
            password: genPassword(),
            authType: getAuthType(),
            protocolVersion: "1.16.0",
            serverType: SERVER_TYPE ?? "subsonic",
            logoutDialogState: false,
            hideServer: HIDE_SERVER ?? false,
            lockUser: hasValidConfig,
            songCount: null,
            favoriteCount: null,
          },
          accounts: {
            discord: {
              rpcEnabled: false,
              setRpcEnabled: (value) => {
                set((state) => {
                  state.accounts.discord.rpcEnabled = value;
                });
              },
            },
          },
          pages: {
            showInfoPanel: true,
            toggleShowInfoPanel: () => {
              const { showInfoPanel } = get().pages;

              set((state) => {
                state.pages.showInfoPanel = !showInfoPanel;
              });
            },
            hideRadiosSection: HIDE_RADIOS_SECTION ?? true,
            setHideRadiosSection: (value) => {
              set((state) => {
                state.pages.hideRadiosSection = value;
              });
            },
            artistsPageViewType: "table",
            setArtistsPageViewType: (type) => {
              set((state) => {
                state.pages.artistsPageViewType = type;
              });
            },
          },
          desktop: {
            data: {
              minimizeToTray: true,
            },
            actions: {
              setMinimizeToTray: (value) => {
                set((state) => {
                  state.desktop.data.minimizeToTray = value;
                });
              },
            },
          },
          command: {
            open: false,
            setOpen: (value) => {
              set((state) => {
                state.command.open = value;
              });
            },
          },
          update: {
            openDialog: false,
            setOpenDialog: (value) => {
              set((state) => {
                state.update.openDialog = value;
              });
            },
            remindOnNextBoot: false,
            setRemindOnNextBoot: (value) => {
              set((state) => {
                state.update.remindOnNextBoot = value;
              });
            },
          },
          settings: {
            openDialog: false,
            setOpenDialog: (value) => {
              set((state) => {
                state.settings.openDialog = value;
              });
            },
            currentPage: "appearance",
            setCurrentPage: (page) => {
              set((state) => {
                state.settings.currentPage = page;
              });
            },
          },
          actions: {
            setOsType: (value) => {
              set((state) => {
                state.data.osType = value;
              });
            },
            setUrl: (value) => {
              set((state) => {
                state.data.url = value;
                state.data.primaryUrl = value;
                state.data.activeServerType = value ? "primary" : null;
              });
            },
            setUsername: (value) => {
              set((state) => {
                state.data.username = value;
              });
            },
            setPassword: (value) => {
              set((state) => {
                state.data.password = value;
              });
            },
            saveConfig: async ({
              url,
              fallbackUrl = "",
              username,
              password,
            }: IServerConfig) => {
              const primaryUrl = normalizeServerUrl(url);
              const normalizedFallbackUrl = normalizeServerUrl(fallbackUrl);

              if (
                !isValidServerUrl(primaryUrl) ||
                (normalizedFallbackUrl &&
                  !isValidServerUrl(normalizedFallbackUrl))
              ) {
                set((state) => {
                  state.data.isServerConfigured = false;
                });

                return false;
              }

              // try both token and password methods
              for (const authType of [AuthType.TOKEN, AuthType.PASSWORD]) {
                const token =
                  authType === AuthType.TOKEN
                    ? genPasswordToken(password)
                    : genEncodedPassword(password);

                const canConnect = await pingServer(
                  primaryUrl,
                  username,
                  token,
                  authType,
                );

                if (canConnect) {
                  const serverInfo =
                    await getServerInfoWithOverride(primaryUrl);

                  set((state) => {
                    state.data.url = primaryUrl;
                    state.data.primaryUrl = primaryUrl;
                    state.data.fallbackUrl = normalizedFallbackUrl;
                    state.data.activeServerType = "primary";
                    state.data.username = username;
                    state.data.password = token;
                    state.data.authType = authType;
                    state.data.protocolVersion = serverInfo.protocolVersion;
                    state.data.serverType = serverInfo.serverType;
                    state.data.isServerConfigured = true;
                  });
                  return true;
                }
              }
              set((state) => {
                state.data.isServerConfigured = false;
              });
              return false;
            },
            saveServerUrls: async ({
              primaryUrl,
              fallbackUrl,
            }: IServerUrlConfig) => {
              const normalizedPrimaryUrl = normalizeServerUrl(primaryUrl);
              const normalizedFallbackUrl = normalizeServerUrl(fallbackUrl);

              if (
                !isValidServerUrl(normalizedPrimaryUrl) ||
                (normalizedFallbackUrl &&
                  !isValidServerUrl(normalizedFallbackUrl))
              ) {
                return false;
              }

              const { username, password, authType } = get().data;

              if (!username || !password || authType === null) {
                return false;
              }

              const resolvedServer = await resolveConfiguredServer({
                primaryUrl: normalizedPrimaryUrl,
                fallbackUrl: normalizedFallbackUrl,
                username,
                password,
                authType,
                serverType: get().data.serverType,
              });

              if (!resolvedServer) {
                return false;
              }

              set((state) => {
                applyConfiguredServerState(state.data, resolvedServer);
              });

              return true;
            },
            selectConfiguredServer: async () => {
              const {
                primaryUrl,
                fallbackUrl,
                username,
                password,
                authType,
                serverType,
              } = get().data;
              const configuredPrimaryUrl = normalizeServerUrl(
                hasValidConfig ? (SERVER_URL ?? primaryUrl) : primaryUrl,
              );
              const configuredFallbackUrl = normalizeServerUrl(
                hasValidConfig ? "" : fallbackUrl,
              );
              const { fallbackUrl: normalizedFallbackUrl } =
                normalizeConfiguredServerUrls(
                  configuredPrimaryUrl,
                  configuredFallbackUrl,
                );

              if (
                !configuredPrimaryUrl ||
                !username ||
                !password ||
                authType === null
              ) {
                return false;
              }

              const resolvedServer = await resolveConfiguredServer({
                primaryUrl: configuredPrimaryUrl,
                fallbackUrl: normalizedFallbackUrl,
                username,
                password,
                authType,
                serverType,
              });

              if (!resolvedServer) {
                set((state) => {
                  state.data.url = configuredPrimaryUrl;
                  state.data.primaryUrl = configuredPrimaryUrl;
                  state.data.fallbackUrl = normalizedFallbackUrl;
                  state.data.activeServerType = null;
                });

                return false;
              }

              set((state) => {
                applyConfiguredServerState(state.data, resolvedServer);
              });

              return true;
            },
            removeConfig: () => {
              set((state) => {
                state.data.isServerConfigured = false;
                state.data.osType = "";
                state.data.url = "";
                state.data.primaryUrl = "";
                state.data.fallbackUrl = "";
                state.data.activeServerType = null;
                state.data.username = "";
                state.data.password = "";
                state.data.authType = AuthType.TOKEN;
                state.data.protocolVersion = "1.16.0";
                state.data.serverType = "subsonic";
                state.data.songCount = null;
                state.data.favoriteCount = null;
                state.pages.showInfoPanel = true;
                state.pages.hideRadiosSection = HIDE_RADIOS_SECTION ?? true;
                state.pages.artistsPageViewType = "table";
              });
            },
            setLogoutDialogState: (value) => {
              set((state) => {
                state.data.logoutDialogState = value;
              });
            },
          },
        })),
        {
          name: "app_store",
        },
      ),
      {
        name: "app_store",
        version: 1,
        merge: (persistedState, currentState) => {
          try {
            const persisted = persistedState as
              | Partial<IAppContext>
              | undefined;

            let hideRadiosSection = true;

            if (persisted) {
              hideRadiosSection = persisted.pages?.hideRadiosSection ?? true;
            }
            if (HIDE_RADIOS_SECTION !== undefined) {
              hideRadiosSection = HIDE_RADIOS_SECTION;
            }

            if (hasValidConfig) {
              const newState = {
                data: {
                  isServerConfigured: true,
                  url: SERVER_URL as string,
                  primaryUrl: SERVER_URL as string,
                  fallbackUrl: "",
                  activeServerType: "primary",
                  username: genUser(),
                  password: genPassword(),
                  authType: getAuthType(),
                  hideServer: HIDE_SERVER ?? false,
                  serverType: SERVER_TYPE ?? "subsonic",
                  lockUser: true,
                },
                pages: {
                  hideRadiosSection,
                },
              };

              if (persistedState) {
                return merge(currentState, persistedState, newState);
              }

              return merge(currentState, newState);
            }

            const activeServerType =
              persisted?.data?.activeServerType !== undefined
                ? persisted.data.activeServerType
                : persisted?.data?.url || persisted?.data?.primaryUrl
                  ? "primary"
                  : null;
            const withoutLockUser = {
              data: {
                lockUser: false,
                primaryUrl:
                  persisted?.data?.primaryUrl ?? persisted?.data?.url ?? "",
                url: persisted?.data?.url ?? persisted?.data?.primaryUrl ?? "",
                fallbackUrl: persisted?.data?.fallbackUrl ?? "",
                activeServerType,
              },
              pages: {
                hideRadiosSection,
              },
            };

            if (persistedState) {
              return merge(currentState, persistedState, withoutLockUser);
            }

            return merge(currentState, withoutLockUser);
          } catch (error) {
            logger.error("[AppStore] [merge] - Unable to merge states", error);

            return currentState;
          }
        },
        partialize: (state) => {
          const appStore = omit(
            state,
            "data.logoutDialogState",
            "data.hideServer",
            "command.open",
            "update",
            "settings",
          );

          return appStore;
        },
      },
    ),
  ),
  shallow,
);

useAppStore.subscribe(
  (state) => state.accounts.discord.rpcEnabled,
  (currentState) => {
    if (currentState) {
      discordRpc.sendCurrentSong();
    } else {
      discordRpc.clear();
    }
  },
);

useAppStore.subscribe(
  (state) => state.desktop.data,
  (data) => {
    if (!isDesktop()) return;

    window.api.saveAppSettings(data);
  },
  {
    equalityFn: shallow,
  },
);

export const useAppData = () => useAppStore((state) => state.data);
export const useAppAccounts = () => useAppStore((state) => state.accounts);
export const useAppPages = () => useAppStore((state) => state.pages);
export const useAppDesktopData = () =>
  useAppStore((state) => state.desktop.data);
export const useAppDesktopActions = () =>
  useAppStore((state) => state.desktop.actions);
export const useAppActions = () => useAppStore((state) => state.actions);
export const useAppUpdate = () => useAppStore((state) => state.update);
export const useAppSettings = () => useAppStore((state) => state.settings);
export const useAppArtistsViewType = () =>
  useAppStore((state) => {
    const { artistsPageViewType, setArtistsPageViewType } = state.pages;

    const isTableView = artistsPageViewType === "table";
    const isGridView = artistsPageViewType === "grid";

    return {
      artistsPageViewType,
      setArtistsPageViewType,
      isTableView,
      isGridView,
    };
  });
