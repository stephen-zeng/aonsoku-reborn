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
const ANIMATE_OUT_MS = 250;
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
    let navigated = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let currentX = 0;
    let snapshot: HTMLDivElement | null = null;
    let overlay: HTMLDivElement | null = null;
    function createSnapshot() {
      const shell = document.getElementById("app-shell");
      if (!shell) return null;
      const clone = shell.cloneNode(true) as HTMLDivElement;
      clone.id = "";
      clone.style.cssText =
        "position:fixed;top:0;left:0;width:100vw;height:100dvh;z-index:10000;pointer-events:none;overflow:hidden;will-change:transform;transition:none;box-shadow:-8px 0 24px rgba(0,0,0,0.18);";
      document.body.appendChild(clone);
      return clone;
    }

    function createOverlay() {
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.25);pointer-events:none;transition:none;will-change:opacity;";
      document.body.appendChild(el);
      return el;
    }

    function cleanup() {
      if (snapshot) {
        snapshot.remove();
        snapshot = null;
      }
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }

    function shouldIgnoreTarget(target: EventTarget | null) {
      if (!target || !(target instanceof HTMLElement)) return false;
      return !!target.closest(
        "[data-vaul-no-drag], input, textarea, [contenteditable]",
      );
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
      navigated = false;
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

        if (isFullscreenOpen()) {
          closeFullscreenPlayerWithHistory();
          tracking = false;
          triggerHaptic();
          return;
        }

        snapshot = createSnapshot();
        overlay = createOverlay();
        navigate(-1);
        navigated = true;
      }

      e.preventDefault();
      currentX = Math.max(0, deltaX);

      if (snapshot) {
        snapshot.style.transform = `translateX(${currentX}px)`;
      }
      if (overlay) {
        const progress = Math.min(
          currentX / (window.innerWidth * TRIGGER_RATIO),
          1,
        );
        overlay.style.opacity = String(1 - progress);
      }
    }

    function onTouchEnd() {
      if (!tracking) return;
      tracking = false;

      if (!directionLocked || !snapshot) {
        cleanup();
        return;
      }

      const elapsed = Date.now() - startTime;
      const velocity = currentX / elapsed;
      const triggered =
        currentX > window.innerWidth * TRIGGER_RATIO ||
        velocity > VELOCITY_THRESHOLD;

      if (triggered) {
        triggerHaptic();
        snapshot.style.transition = `transform ${ANIMATE_OUT_MS}ms cubic-bezier(0.2,0.9,0.3,1)`;
        snapshot.style.transform = "translateX(100vw)";
        if (overlay) {
          overlay.style.transition = `opacity ${ANIMATE_OUT_MS}ms ease`;
          overlay.style.opacity = "0";
        }
        setTimeout(cleanup, ANIMATE_OUT_MS);
      } else {
        snapshot.style.transition = `transform ${SNAP_BACK_MS}ms cubic-bezier(0.2,0.9,0.3,1)`;
        snapshot.style.transform = "translateX(0)";
        if (overlay) {
          overlay.style.transition = `opacity ${SNAP_BACK_MS}ms ease`;
          overlay.style.opacity = "1";
        }
        setTimeout(() => {
          cleanup();
          if (navigated) navigate(1);
        }, SNAP_BACK_MS);
      }

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
      cleanup();
    };
  }, [isMobile, navigate]);

  return null;
}
