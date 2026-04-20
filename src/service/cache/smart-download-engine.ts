import { subsonic } from "@/service/subsonic";
import { useCacheStore } from "@/store/cache.store";
import {
  getCacheIndexActions,
  getCacheIndexItems,
} from "@/store/cache-index.store";
import { libraryDb } from "@/store/library-db";
import type { SmartRuleSettings } from "@/types/cache";
import { audioKey } from "./cache-keys";
import { cacheManager } from "./cache-manager";
import { cacheStorage } from "./cache-storage";

const DAY_MS = 24 * 60 * 60 * 1000;

type TriggerMap = Map<string, Set<string>>;

/**
 * SmartDownloadEngine — derives a target set of songIds from the
 * active smart-download rules, diffs it against the current smart
 * pool in the cache index, and enqueues add/remove operations to
 * converge. Runs on demand (post-sync, settings change, manual
 * refresh). Not a subscription layer — callers trigger
 * `recomputeMatches()`.
 *
 * Rules consulted today:
 *  - favoriteSongs       : libraryDb.songs where `starredAt > 0`
 *  - favoritePlaylists   : for each libraryDb.playlists with
 *      `starredAt > 0`, union the Subsonic `getPlaylist` entries.
 *      Best-effort: a failed fetch (offline / 404) simply skips that
 *      playlist rather than blowing up the whole pass.
 *  - frequentPlays       : libraryDb.songs where
 *      `playCount >= threshold`
 *  - recentPlays         : libraryDb.songs where
 *      `playedAt > now - (days * 1d)`
 *
 * Multi-rule hits are tracked per-song: a song kept by both "favorite"
 * and "frequent" lists both names in its `triggers` array, and is
 * evicted only when every triggering rule stops matching.
 */
class SmartDownloadEngine {
  private running = false;

  async recomputeMatches(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const settings = useCacheStore.getState().settings.smartRules;
      const target: TriggerMap = settings.enabled
        ? await this.computeMatches(settings)
        : new Map();

      await this.reconcile(target);
    } catch (err) {
      console.error("[smart-download] recompute failed:", err);
    } finally {
      this.running = false;
    }
  }

  private async computeMatches(
    settings: SmartRuleSettings,
  ): Promise<TriggerMap> {
    const target: TriggerMap = new Map();
    const addTrigger = (songId: string, trigger: string) => {
      let set = target.get(songId);
      if (!set) {
        set = new Set();
        target.set(songId, set);
      }
      set.add(trigger);
    };

    if (settings.favoriteSongs) {
      const starred = await libraryDb.songs
        .where("starredAt")
        .above(0)
        .toArray();
      for (const song of starred) {
        addTrigger(song.id, "favorite");
      }
    }

    if (settings.frequentPlays) {
      const threshold = Math.max(1, settings.frequentPlaysThreshold);
      const frequent = await libraryDb.songs
        .where("playCount")
        .aboveOrEqual(threshold)
        .toArray();
      for (const song of frequent) {
        addTrigger(song.id, "frequent");
      }
    }

    if (settings.recentPlays) {
      const days = Math.max(1, settings.recentPlaysDays);
      const cutoff = Date.now() - days * DAY_MS;
      const recent = await libraryDb.songs
        .where("playedAt")
        .above(cutoff)
        .toArray();
      for (const song of recent) {
        addTrigger(song.id, "recent");
      }
    }

    if (settings.favoritePlaylists && navigator.onLine) {
      const starredLists = await libraryDb.playlists
        .where("starredAt")
        .above(0)
        .toArray();
      for (const pl of starredLists) {
        try {
          const detail = await subsonic.playlists.getOne(pl.id);
          for (const entry of detail?.entry ?? []) {
            addTrigger(entry.id, "playlist");
          }
        } catch (err) {
          console.warn(
            `[smart-download] failed to load playlist ${pl.id}:`,
            err,
          );
        }
      }
    }

    return target;
  }

  private async reconcile(target: TriggerMap): Promise<void> {
    const items = getCacheIndexItems();
    const smartQuota = useCacheStore.getState().settings.smartQuota;
    let projectedSmartUsage = Object.values(items).reduce((sum, meta) => {
      if (meta.type === "audio" && meta.source === "smart") {
        return sum + meta.sizeBytes;
      }
      return sum;
    }, 0);

    // Prune: smart entries not in target anymore.
    for (const [key, meta] of Object.entries(items)) {
      if (meta.type !== "audio" || meta.source !== "smart") continue;
      if (!target.has(meta.id)) {
        projectedSmartUsage -= meta.sizeBytes;
        await this.evictSmartEntry(key);
      }
    }

    // Sync triggers on still-matching entries.
    for (const [songId, triggersSet] of target) {
      const key = audioKey(songId);
      const existing = getCacheIndexItems()[key];
      const triggers = Array.from(triggersSet);

      if (!existing) {
        if (
          !(await this.canAdmitSmartSong(
            songId,
            projectedSmartUsage,
            smartQuota,
          ))
        ) {
          continue;
        }
        try {
          await cacheManager.cacheSmartSong(songId, triggers);
          const added = getCacheIndexItems()[key];
          if (added?.type === "audio" && added.source === "smart") {
            projectedSmartUsage += added.sizeBytes;
          }
        } catch (err) {
          console.warn(`[smart-download] failed to cache ${songId}:`, err);
        }
      } else if (existing.source === "smart") {
        const current = new Set(existing.triggers ?? []);
        const incoming = new Set(triggers);
        if (!setsEqual(current, incoming)) {
          getCacheIndexActions().addItem(key, {
            ...existing,
            triggers,
            lastAccessedAt: existing.lastAccessedAt,
          });
        }
      }
      // Explicit/lru entries are left alone — cacheSmartSong already
      // refuses to demote explicit, and the lru→smart upgrade path is
      // handled inside cacheSmartSong.
    }
  }

  private async canAdmitSmartSong(
    songId: string,
    projectedSmartUsage: number,
    smartQuota: number,
  ): Promise<boolean> {
    if (smartQuota === 0) return true;

    const row = await libraryDb.songs.get(songId);
    const estimatedSize = row?.size ?? 0;

    if (estimatedSize > 0) {
      return projectedSmartUsage + estimatedSize <= smartQuota;
    }
    return projectedSmartUsage < smartQuota;
  }

  private async evictSmartEntry(key: string): Promise<void> {
    await cacheStorage.delete(key);
    getCacheIndexActions().removeItem(key);
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export const smartDownloadEngine = new SmartDownloadEngine();
