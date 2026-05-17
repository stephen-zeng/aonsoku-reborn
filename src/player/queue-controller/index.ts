import { getRuntime } from "@/utils/capabilities";
import type { QueueController } from "./types";
import { WebQueueController } from "./web-controller";

let instance: QueueController | null = null;

export function getQueueController(): QueueController {
  if (!instance) {
    instance = createQueueController();
  }
  return instance;
}

function createQueueController(): QueueController {
  if (getRuntime() === "capacitor-ios") {
    // Phase 4: NativeQueueController will be imported here
    return new WebQueueController();
  }
  return new WebQueueController();
}

export function resetQueueController(): void {
  instance?.dispose();
  instance = null;
}

export type { QueueController } from "./types";
export type {
  QueueControllerState,
  QueueControllerEvent,
  QueueControllerListener,
  QueueStateChangeEvent,
  QueueStateChangeReason,
} from "./types";
