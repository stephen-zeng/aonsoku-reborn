import { useEffect } from "react";
import { migrateLegacyStoresIfNeeded } from "@/store/library-db";

/**
 * Runs the one-time copy from the legacy idb-keyval stores
 * (`offline-library`, `cache-index`) into the typed Dexie schema.
 * Non-blocking: the promise is fired on mount and any failure is logged
 * but swallowed so the app keeps working on the legacy read path until
 * P1.2 flips readers to the new schema.
 */
export function LibraryMigrationObserver() {
  useEffect(() => {
    migrateLegacyStoresIfNeeded().catch((err) => {
      console.error("[LibraryMigrationObserver] unexpected error:", err);
    });
  }, []);

  return null;
}
