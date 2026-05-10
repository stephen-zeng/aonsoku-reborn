import { expose, wrap } from "comlink";
import { SyncWorkerService } from "@/service/cache/sync-worker-service";
import type { Callbacks } from "@/service/cache/sync-worker-service";

const service = new SyncWorkerService();

expose({
  syncAll: (options) => service.syncAll(options),
  syncIncremental: (options) => service.syncIncremental(options),
  cancel: () => service.cancel(),
  initAuth: (config) => service.initAuth(config),
  updateAuth: (config) => service.updateAuth(config),
  setCallbackPort: (port: MessagePort) => {
    service.setCallbacks(wrap<Callbacks>(port));
  },
});
