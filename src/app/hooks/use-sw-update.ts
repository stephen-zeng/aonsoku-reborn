import { useEffect, useState } from "react";
import {
  applySwUpdate,
  registerServiceWorker,
  retrySwUpdate,
  type SwStatus,
} from "@/utils/sw-register";

export function useSwUpdate() {
  const [status, setStatus] = useState<SwStatus>("idle");

  useEffect(() => {
    return registerServiceWorker(setStatus);
  }, []);

  return {
    status,
    applyUpdate: applySwUpdate,
    retryUpdate: retrySwUpdate,
  };
}
