export type SwStatus = "idle" | "installing" | "waiting";

type SwStatusCallback = (status: SwStatus) => void;

let registered = false;
let waitingWorker: ServiceWorker | null = null;

/**
 * Register and manage the service worker lifecycle.
 * Only registers on hostnames ending with "aonsoku.realtvop.top".
 * Guarded against multiple calls (React StrictMode).
 */
export function registerServiceWorker(
  onStatusChange: SwStatusCallback,
): void {
  if (registered) return;
  if (!("serviceWorker" in navigator)) return;
  if (!location.hostname.endsWith("aonsoku.realtvop.top")) return;

  registered = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      reg.update();

      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        onStatusChange("waiting");
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        onStatusChange("installing");

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            waitingWorker = newWorker;
            onStatusChange("waiting");
          }

          if (newWorker.state === "redundant") {
            onStatusChange("idle");
          }
        });
      });
    })
    .catch(() => {
      // Registration failed — silently ignore
    });
}

/**
 * Tell the waiting service worker to skip waiting and take over.
 * The controllerchange listener will then reload the page.
 */
export function applySwUpdate(): void {
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
}
