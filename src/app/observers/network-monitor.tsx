import { useEffect } from "react";
import { useCacheActions } from "@/store/cache.store";

interface NetworkInformationLike {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

function getConnection(): NetworkInformationLike | undefined {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function evaluateMetered(conn: NetworkInformationLike | undefined): boolean {
  if (!conn) return false;
  if (conn.saveData) return true;
  if (conn.type === "cellular") return true;
  const effective = conn.effectiveType;
  if (effective === "slow-2g" || effective === "2g" || effective === "3g") {
    return true;
  }
  return false;
}

/**
 * Keeps `cache.store.status.isMetered` in sync with the Network
 * Information API (`navigator.connection`). Startup sync, focus
 * sync, and the smart-download engine (P5) read this flag and back
 * off when the connection is expensive or slow. User-initiated
 * downloads (Save File, explicit cache, manual refresh) are
 * intentionally unaffected — the user has already decided.
 *
 * On browsers without the Network Information API (notably Safari
 * desktop as of early 2026), `isMetered` stays false; the rest of the
 * app degrades to the online/offline dichotomy.
 */
export function NetworkMonitorObserver() {
  const { setIsMetered } = useCacheActions();

  useEffect(() => {
    const conn = getConnection();
    setIsMetered(evaluateMetered(conn));

    if (!conn || !conn.addEventListener) return;

    const handleChange = () => setIsMetered(evaluateMetered(conn));
    conn.addEventListener("change", handleChange);
    return () => {
      conn.removeEventListener?.("change", handleChange);
    };
  }, [setIsMetered]);

  return null;
}
