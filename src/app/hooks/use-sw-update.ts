import { useEffect, useState } from "react";
import {
  type SwStatus,
  applySwUpdate,
  registerServiceWorker,
} from "@/utils/sw-register";

export function useSwUpdate() {
  const [status, setStatus] = useState<SwStatus>("idle");

  useEffect(() => {
    registerServiceWorker(setStatus);
  }, []);

  return { status, applyUpdate: applySwUpdate };
}
