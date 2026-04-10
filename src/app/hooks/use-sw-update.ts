import { useEffect, useState } from "react";
import {
  type SwStatus,
  applySwUpdate,
  registerServiceWorker,
  retrySwUpdate,
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
