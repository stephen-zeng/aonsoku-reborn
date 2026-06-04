export type BackButtonHandler = () => boolean;

const handlers: BackButtonHandler[] = [];

/**
 * Register a back button handler. Handlers are executed in LIFO (Last-In, First-Out) order.
 * The handler should return `true` if it handled the back press (e.g. closed a modal),
 * or `false` if it did not.
 */
export function registerBackButtonHandler(handler: BackButtonHandler) {
  handlers.push(handler);
}

/**
 * Unregister a back button handler.
 */
export function unregisterBackButtonHandler(handler: BackButtonHandler) {
  const index = handlers.indexOf(handler);
  if (index !== -1) {
    handlers.splice(index, 1);
  }
}

/**
 * Execute the registered back button handlers.
 * Returns `true` if any handler intercepted/handled the back event, `false` otherwise.
 */
export function executeBackButtonHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    const handled = handlers[i]();
    if (handled) {
      return true;
    }
  }
  return false;
}
