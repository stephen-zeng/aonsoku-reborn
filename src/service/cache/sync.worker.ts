import { expose } from "comlink";
import { SyncWorkerService } from "@/service/cache/sync-worker-service";

let service: SyncWorkerService;

function init(): void {
  service = new SyncWorkerService();
  expose(service);
}

init();