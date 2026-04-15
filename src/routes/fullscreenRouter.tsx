import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useIsMobile } from "@/app/hooks/use-mobile";
import { usePlayerStore } from "@/store/player.store";
import type { FullscreenPlayerTab } from "@/types/playerContext";
import { PLAYER_SEARCH_PARAM } from "@/routes/routesList";

const VALID_TABS: ReadonlySet<string> = new Set(["playing", "lyrics", "queue"]);

type NavigateFn = (
  to: { search: string },
  options?: { replace?: boolean },
) => void;

let _navigate: NavigateFn | null = null;
let _isMobile = false;
let _currentSearchParams: URLSearchParams = new URLSearchParams();

export function setFullscreenNavigator(navigate: NavigateFn | null) {
  _navigate = navigate;
}

function buildSearch(playerTab: string | null): string {
  const params = new URLSearchParams(_currentSearchParams);
  if (playerTab) {
    params.set(PLAYER_SEARCH_PARAM, playerTab);
  } else {
    params.delete(PLAYER_SEARCH_PARAM);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function navigateToFullscreenPlayer(tab: string) {
  _navigate?.({ search: buildSearch(tab) }, { replace: false });
}

export function navigateToFullscreenTab(tab: string) {
  _navigate?.({ search: buildSearch(tab) }, { replace: !_isMobile });
}

export function navigateFromFullscreen() {
  if (!_navigate) return;
  if (window.history.state?.idx > 0) {
    window.history.back();
  } else {
    _navigate({ search: buildSearch(null) }, { replace: true });
  }
}

export function openFullscreenPlayerWithHistory(tab: FullscreenPlayerTab) {
  if (!_navigate) return;
  const state = usePlayerStore.getState();
  state.actions.openFullscreenPlayer(tab);
  navigateToFullscreenPlayer(tab);
}

export function setFullscreenTabWithHistory(tab: FullscreenPlayerTab) {
  if (!_navigate) return;
  const state = usePlayerStore.getState();
  state.actions.setFullscreenPlayerTab(tab);
  navigateToFullscreenTab(tab);
}

export function FullscreenPlayerRouter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    _isMobile = isMobile;
    _currentSearchParams = new URLSearchParams(searchParams.toString());
  }, [isMobile, searchParams]);

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
      if (isMobile && fullscreenPlayerTab !== "playing") {
        state.actions.setFullscreenPlayerTab("playing");
        navigate({ search: buildSearch("playing") }, { replace: true });
      } else {
        state.actions.closeFullscreenPlayer();
      }
    }
  }, [searchParams, isMobile, navigate]);

  return null;
}
