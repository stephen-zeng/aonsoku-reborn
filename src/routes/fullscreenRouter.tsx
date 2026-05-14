import { useEffect } from "react";
import {
  type NavigateFunction,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useIsMobile } from "@/app/hooks/use-mobile";
import { PLAYER_SEARCH_PARAM } from "@/routes/routesList";
import { usePlayerStore } from "@/store/player.store";
import type { FullscreenPlayerTab } from "@/types/playerContext";

const VALID_TABS: ReadonlySet<string> = new Set([
  "playing",
  "lyrics",
  "queue",
  "customLyrics",
]);
const FULLSCREEN_HISTORY_STATE_KEY = "__fullscreenPlayerHistory";

type FullscreenHistoryStep = "root" | "detail";

type FullscreenHistoryState = {
  sessionId: string;
  step: FullscreenHistoryStep;
  closeSteps: 1 | 2;
};

type FullscreenNavState = {
  navigate: NavigateFunction | null;
  isMobile: boolean;
  locationState: unknown;
};

const navState: FullscreenNavState = {
  navigate: null,
  isMobile: false,
  locationState: null,
};

let pendingCloseNavigation: number | null = null;

export function setFullscreenNavigator(navigate: NavigateFunction | null) {
  if (!navigate) clearPendingCloseNavigation();

  navState.navigate = navigate;
}

function clearPendingCloseNavigation() {
  if (pendingCloseNavigation === null) return;

  window.clearTimeout(pendingCloseNavigation);
  pendingCloseNavigation = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFullscreenHistoryState(
  value: unknown,
): value is FullscreenHistoryState {
  if (!isRecord(value)) return false;

  return (
    typeof value.sessionId === "string" &&
    (value.step === "root" || value.step === "detail") &&
    (value.closeSteps === 1 || value.closeSteps === 2)
  );
}

function getCurrentHistoryState(): unknown {
  const historyState = window.history.state;
  if (isRecord(historyState) && "usr" in historyState) {
    return historyState.usr;
  }
  return null;
}

function getFullscreenHistoryState(
  state: unknown = navState.locationState,
): FullscreenHistoryState | null {
  if (!isRecord(state)) return null;

  const historyState = state[FULLSCREEN_HISTORY_STATE_KEY];
  return isFullscreenHistoryState(historyState) ? historyState : null;
}

function buildNavigationState(
  historyState: FullscreenHistoryState | null,
): Record<string, unknown> | undefined {
  const currentState = getCurrentHistoryState() ?? navState.locationState;
  const nextState = isRecord(currentState) ? { ...currentState } : {};

  if (historyState) {
    nextState[FULLSCREEN_HISTORY_STATE_KEY] = historyState;
  } else {
    delete nextState[FULLSCREEN_HISTORY_STATE_KEY];
  }

  return Object.keys(nextState).length > 0 ? nextState : undefined;
}

function buildSearch(playerTab: string | null): string {
  const currentSearch = window.location.hash.split("?")[1] ?? "";
  const params = new URLSearchParams(currentSearch);
  if (playerTab) {
    params.set(PLAYER_SEARCH_PARAM, playerTab);
  } else {
    params.delete(PLAYER_SEARCH_PARAM);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

function createFullscreenHistoryState(
  sessionId: string,
  step: FullscreenHistoryStep,
): FullscreenHistoryState {
  return {
    sessionId,
    step,
    closeSteps: step === "root" ? 1 : 2,
  };
}

function createSessionId() {
  return `fullscreen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function navigateWithSearch(
  playerTab: FullscreenPlayerTab | null,
  options?: {
    replace?: boolean;
    historyState?: FullscreenHistoryState | null;
  },
) {
  navState.navigate?.(
    { search: buildSearch(playerTab) },
    {
      replace: options?.replace,
      state: buildNavigationState(options?.historyState ?? null),
    },
  );
}

export function openFullscreenPlayerWithHistory(tab: FullscreenPlayerTab) {
  if (!navState.navigate) return;

  clearPendingCloseNavigation();

  const playerStore = usePlayerStore.getState();
  const { fullscreenPlayerOpen } = playerStore.playerState;

  if (fullscreenPlayerOpen) {
    setFullscreenTabWithHistory(tab);
    return;
  }

  playerStore.actions.openFullscreenPlayer(tab);

  if (!navState.isMobile) {
    navigateWithSearch(tab, { replace: false });
    return;
  }

  const sessionId = createSessionId();

  if (tab === "playing") {
    navigateWithSearch("playing", {
      replace: false,
      historyState: createFullscreenHistoryState(sessionId, "root"),
    });
    return;
  }

  navigateWithSearch("playing", {
    replace: false,
    historyState: createFullscreenHistoryState(sessionId, "root"),
  });
  navigateWithSearch(tab, {
    replace: false,
    historyState: createFullscreenHistoryState(sessionId, "detail"),
  });
}

export function setFullscreenTabWithHistory(tab: FullscreenPlayerTab) {
  if (!navState.navigate) return;

  clearPendingCloseNavigation();

  const playerStore = usePlayerStore.getState();
  const { fullscreenPlayerTab } = playerStore.playerState;
  const historyState = getFullscreenHistoryState(getCurrentHistoryState());

  playerStore.actions.setFullscreenPlayerTab(tab);

  if (!navState.isMobile) {
    navigateWithSearch(tab, { replace: true });
    return;
  }

  if (!historyState) {
    navigateWithSearch(tab, { replace: true });
    return;
  }

  if (tab === "playing") {
    if (historyState.step === "detail") {
      navState.navigate(-1);
      return;
    }

    navigateWithSearch("playing", {
      replace: true,
      historyState: createFullscreenHistoryState(
        historyState.sessionId,
        "root",
      ),
    });
    return;
  }

  if (fullscreenPlayerTab === "playing" && historyState.step === "root") {
    navigateWithSearch(tab, {
      replace: false,
      historyState: createFullscreenHistoryState(
        historyState.sessionId,
        "detail",
      ),
    });
    return;
  }

  navigateWithSearch(tab, {
    replace: true,
    historyState: createFullscreenHistoryState(
      historyState.sessionId,
      "detail",
    ),
  });
}

export function closeFullscreenPlayerWithHistory(options?: {
  historyDelayMs?: number;
}) {
  if (!navState.navigate) return;

  const historyState = getFullscreenHistoryState(getCurrentHistoryState());
  const delay = options?.historyDelayMs ?? 0;

  clearPendingCloseNavigation();

  usePlayerStore.getState().actions.closeFullscreenPlayer();

  const closeRoute = () => {
    pendingCloseNavigation = null;

    if (usePlayerStore.getState().playerState.fullscreenPlayerOpen) {
      return;
    }

    if (historyState) {
      const currentHistoryState = getFullscreenHistoryState(
        getCurrentHistoryState(),
      );

      if (
        !currentHistoryState ||
        currentHistoryState.sessionId !== historyState.sessionId ||
        currentHistoryState.step !== historyState.step
      ) {
        return;
      }

      navState.navigate?.(-historyState.closeSteps);
      return;
    }

    const currentSearch = window.location.hash.split("?")[1] ?? "";
    if (!new URLSearchParams(currentSearch).has(PLAYER_SEARCH_PARAM)) {
      return;
    }

    navigateWithSearch(null, { replace: true });
  };

  if (delay > 0) {
    pendingCloseNavigation = window.setTimeout(closeRoute, delay);
    return;
  }

  closeRoute();
}

export function FullscreenPlayerRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    navState.isMobile = isMobile;
    navState.locationState = location.state;
  }, [isMobile, location.state]);

  useEffect(() => {
    setFullscreenNavigator(navigate);
    return () => setFullscreenNavigator(null);
  }, [navigate]);

  useEffect(() => {
    const param = searchParams.get(PLAYER_SEARCH_PARAM);
    const state = usePlayerStore.getState();
    const { fullscreenPlayerOpen, fullscreenPlayerTab } = state.playerState;

    if (param && VALID_TABS.has(param)) {
      const tab = param as FullscreenPlayerTab;
      if (!fullscreenPlayerOpen) {
        state.actions.openFullscreenPlayer(tab);
      } else if (fullscreenPlayerTab !== tab) {
        state.actions.setFullscreenPlayerTab(tab);
      }
    } else if (!param && fullscreenPlayerOpen) {
      state.actions.closeFullscreenPlayer();
    }
  }, [searchParams]);

  return null;
}
