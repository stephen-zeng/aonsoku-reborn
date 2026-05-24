import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useIsMobile } from "@/app/hooks/use-mobile";
import { closeFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { ROUTES } from "@/routes/routesList";
import { usePlayerStore } from "@/store/player.store";

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const EDGE_ZONE = 20;
const TRIGGER_RATIO = 0.4;
const VELOCITY_THRESHOLD = 0.3;
const DIRECTION_LOCK_DISTANCE = 10;
const SNAP_BACK_MS = 300;

const ROOT_PATHS = new Set([
  ROUTES.LIBRARY.HOME,
  ROUTES.MOBILE.LIBRARY,
  ROUTES.MOBILE.SEARCH,
]);

function isRootPage(pathname: string) {
  return ROOT_PATHS.has(pathname);
}

export function SwipeBackObserver() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!isNativeIOS || !isMobile) return;

    let tracking = false;
    let directionLocked = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let currentX = 0;
    let overlay: HTMLDivElement | null = null;
    let mainEl: HTMLElement | null = null;

    function getMainEl() {
      if (!mainEl) mainEl = document.querySelector("main");
      return mainEl;
    }
    function createOverlay() {
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0);pointer-events:none;transition:none;";
      document.body.appendChild(el);
      return el;
    }

    function removeOverlay() {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }

    function resetMain(animate: boolean) {
      const el = getMainEl();
      if (!el) return;
      if (animate) {
        el.style.transition = `transform ${SNAP_BACK_MS}ms cubic-bezier(0.2,0.9,0.3,1)`;
        el.style.transform = "";
        const cleanup = () => {
          el.style.transition = "";
          el.style.transform = "";
          el.removeEventListener("transitionend", cleanup);
        };
        el.addEventListener("transitionend", cleanup, { once: true });
      } else {
        el.style.transition = "";
        el.style.transform = "";
      }
    }

    function shouldIgnoreTarget(target: EventTarget | null) {
      if (!target || !(target instanceof HTMLElement)) return false;
      const el = target.closest(
        "[data-vaul-no-drag], input, textarea, [contenteditable]",
      );
      return !!el;
    }

    function isFullscreenOpen() {
      return usePlayerStore.getState().playerState.fullscreenPlayerOpen;
    }

    function triggerHaptic() {
      const { hapticFeedbackEnabled } =
        usePlayerStore.getState().settings.hapticFeedback;
      if (hapticFeedbackEnabled) {
        Haptics.impact({ style: ImpactStyle.Light });
      }
    }
    function onTouchStart(e: TouchEvent) {
      if (tracking) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE) return;
      if (shouldIgnoreTarget(e.target)) return;

      const fullscreen = isFullscreenOpen();
      if (!fullscreen && isRootPage(pathnameRef.current)) return;

      tracking = true;
      directionLocked = false;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      currentX = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!directionLocked) {
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (dist < DIRECTION_LOCK_DISTANCE) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          tracking = false;
          return;
        }
        directionLocked = true;
        if (!overlay) overlay = createOverlay();
        const el = getMainEl();
        if (el) el.style.transition = "none";
      }

      e.preventDefault();

      currentX = Math.max(0, deltaX);
      const el = getMainEl();
      if (el) el.style.transform = `translateX(${currentX}px)`;
      if (overlay) {
        const progress = Math.min(currentX / (window.innerWidth * TRIGGER_RATIO), 1);
        overlay.style.background = `rgba(0,0,0,${0.15 * (1 - progress)})`;
      }
    }

    function onTouchEnd() {
      if (!tracking) return;
      tracking = false;

      const elapsed = Date.now() - startTime;
      const velocity = currentX / elapsed;
      const triggered =
        currentX > window.innerWidth * TRIGGER_RATIO ||
        velocity > VELOCITY_THRESHOLD;

      if (triggered && currentX > 20) {
        triggerHaptic();
        if (isFullscreenOpen()) {
          closeFullscreenPlayerWithHistory();
        } else {
          navigate(-1);
        }
      }

      resetMain(!triggered || !isFullscreenOpen());
      removeOverlay();
      directionLocked = false;
      currentX = 0;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      removeOverlay();
      resetMain(false);
      mainEl = null;
    };
  }, [isMobile, navigate]);

  return null;
}
