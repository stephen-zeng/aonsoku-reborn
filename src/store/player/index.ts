import { registerPlayerPersistence } from "./persistence";
import {
  addPlayerCleanupCallback,
  cleanupPlayerStore,
  registerPlayerStoreSubscriptions,
} from "./subscriptions";
import { usePlayerStore } from "./store";

registerPlayerPersistence(usePlayerStore, addPlayerCleanupCallback);
registerPlayerStoreSubscriptions(usePlayerStore);

export * from "./selectors";
export { cleanupPlayerStore };
export { usePlayerStore } from "./store";
