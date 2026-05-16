# Progress

This document tracks the completed work for the native audio roadmap. Update it
after every completed sub-step, including verification results and the git
commit that contains the change.

## Current Status

- Roadmap status: Phase 3 in progress.
- Active implementation phase: Phase 3 - Capacitor Bridge Foundation.
- Next step: Phase 3.2, route Capacitor iOS to native backend.
- Android status: blocked until the full iOS native implementation is complete.

## Completed Work

| Date | Step | Summary | Verification | Commit |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Requirements and roadmap documentation | Created the native audio roadmap document set covering requirements, phase order, playback/queue modularization, cache modularization, iOS-native implementation, Android gating, and the test/commit protocol. | Documentation-only change. `biome lint` ran during commit and passed. | `000f1a29 chore(docs): add native audio implementation roadmap` |
| 2026-05-16 | Phase 0.1 - Capture baseline behavior | Ran existing unit tests (482 passing, 0 failing, 0 flaky). Added baseline regression tests for queue utilities (88 tests) and platform detection (16 tests). Total test count went from 482 to 570. All tests pass, lint clean. | `pnpm run test:unit` 570/570 passed. `biome lint` passed. | `2bf22f38 test(player): capture playback and queue baseline` |
| 2026-05-17 | Phase 0.2 - Add platform capability detection | Created `src/utils/capabilities.ts` with `detectRuntime()`, `getRuntime()`, `getPlaybackCapabilities()`, and `getDesktopCapabilities()`. Migrated all 7 `isIOS()` call sites to capability queries (`canSetVolume`, `requiresSystemVolume`). Added 17 capability tests. Total 587 tests pass. Build succeeds. | `pnpm run test:unit` 587/587 passed. `biome lint` passed. `pnpm run build` succeeded. | `7e35d40e refactor(platform): centralize runtime capability detection` |
| 2026-05-17 | Phase 1.1 - Extract pure queue transitions | Created `src/store/player/queue-transitions.ts` with 13 pure transition functions extracted from `queue-actions.ts`. Added 59 tests in `queue-transitions.test.ts`. Total 646 tests pass. Build succeeds. | `pnpm run test:unit` 646/646 passed. `biome lint` passed. `pnpm run build` succeeded. | `cacd277b refactor(queue): extract pure queue transitions` |
| 2026-05-17 | Phase 0 review - Runtime detection correction | Corrected `detectRuntime()` to use Capacitor native platform detection instead of iOS/Android user-agent checks, so browser/PWA sessions stay `web`; preserved iOS system-volume capability behavior for web. | `pnpm vitest run src/utils/capabilities.test.ts` 21/21 passed. `pnpm run test:unit` 650/650 passed. `pnpm run lint` passed. `pnpm run build` succeeded. | `a8480d2a fix(platform): detect native capacitor runtimes correctly` |
| 2026-05-17 | Phase 1.2 - Define playback backend contract | Added typed playback source descriptors and the `PlaybackBackend` contract for load, play, pause, stop, seek, loop, volume, preload, dispose, and events. Added `WebAudioPlaybackBackend` around `HTMLAudioElement` and routed `AudioPlayer` imperative load/play/pause/seek/volume calls through it. | `pnpm vitest run src/player/playback/playback-backend.test.ts` 7/7 passed. `pnpm run test:unit` 657/657 passed. `pnpm run lint` passed. `pnpm run build` succeeded. Cypress component tests not run per known local Cypress issue/user instruction. | `18607812 refactor(player): introduce playback backend contract` |
| 2026-05-17 | Phase 1.3 - Extract playback orchestration | Added `PlaybackSession` for source-change flags, retry timers, pending resume, play/pause/end decisions, and progress/buffer/duration helpers. `AudioPlayer` now delegates orchestration decisions to the session while ReplayGain stays on the web audio path. | `pnpm vitest run src/player/playback/playback-backend.test.ts src/player/playback/session.test.ts` 20/20 passed. `pnpm run test:unit` 670/670 passed. `pnpm run lint` passed. `pnpm run build` succeeded. Cypress component tests not run per known local Cypress issue/user instruction. | `6d3d98e6 refactor(player): isolate playback session orchestration` |
| 2026-05-17 | Phase 1.4 - Split player store responsibilities | Kept `@/store/player.store` stable while splitting store creation, selectors, persistence/migrations/IDB flushing, and side-effect subscriptions into dedicated modules. Added persistence/migration tests. No persisted schema change. | `pnpm vitest run src/store/player/persistence.test.ts` 5/5 passed. `pnpm vitest run src/store/player/*.test.ts src/store/player/persistence.test.ts` 151/151 passed. `pnpm run test:unit` 675/675 passed. `pnpm run lint` passed. `pnpm run build` succeeded. Cypress not applicable for this store-only step and not run per user instruction. | `11f734ca refactor(player-store): split persistence and action modules` |
| 2026-05-17 | Phase 2.1 - Define cache service contracts | Added cache storage, index, metadata persistence, audio download service/queue, audio URL/source resolver, and native file resolver contracts. Added default adapters around the current Cache API, Zustand index, Dexie metadata persistence, and audio download service, plus test fakes for future resolver work. | `pnpm exec vitest run src/service/cache/contracts/fakes.test.ts src/service/cache/audio-url-resolver.test.ts src/service/cache/cache-storage.test.ts src/service/cache/persist-meta.test.ts src/service/cache/audio-cache-queue.test.ts` 48/48 passed. `pnpm run test:unit` 687/687 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. | `72a88af4 refactor(cache): define cache service contracts` |
| 2026-05-17 | Phase 2.2 - Split audio URL resolution | Added `CacheAudioSourceResolver` to return typed stream/blob/native-file source descriptors and moved cached-or-stream selection out of React hooks. Added `useAudioSource(songId)`, kept `useCachedAudioUrl` as a compatibility wrapper, routed preloading through the resolver, and passed typed song sources into `AudioPlayer` while preserving string `src` playback. | `pnpm exec vitest run src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts src/service/cache/audio-url-resolver.test.ts` 28/28 passed. `pnpm run test:unit` 693/693 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. | `8090d3c3 refactor(cache): isolate audio source resolution` |
| 2026-05-17 | Phase 2.3 - Prepare native cache access | Added `NativeCacheAdapter` contract extending `NativeFileResolver` with `storeAudioFile`, `getAudioFileSize`, and `evictAudioFile`. Added `FakeNativeCacheAdapter` for tests. Created `native-cache-adapter.ts` with platform-aware factory that returns a null adapter on web and throws on iOS/Android (not yet implemented). Wired the factory into `CacheAudioSourceResolver` as the default `nativeFileResolver`. Added 18 new tests: 5 for `FakeNativeCacheAdapter`, 11 for `getNativeCacheAdapter` platform selection, and 2 for resolver integration with `NativeCacheAdapter`. | `pnpm exec vitest run src/service/cache/contracts/fakes.test.ts src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts` 34/34 passed. `pnpm run test:unit` 711/711 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. | `5e250d17 refactor(cache): prepare native cache adapter` |
| 2026-05-17 | Phase 3.1 - Add TypeScript native plugin facades | Added the `src/native/audio/` facade with typed Capacitor plugin registration, native source descriptors, metadata, queue/control methods, typed event payloads, unavailable-safe web behavior, plugin availability checks, and typed listener helpers. No Android dependency or project file was added. | `pnpm exec vitest run src/native/audio/facade.test.ts` 6/6 passed. `pnpm run test:unit` 717/717 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. Commit hook Biome lint passed. | `f9d2d498 refactor(capacitor): add native audio facade` |

## Phase Checklist

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Baseline And Guardrails | Complete | Both Phase 0.1 and 0.2 done. Follow-up review corrected browser/PWA vs native Capacitor runtime detection. |
| Phase 1 - Playback And Queue Modularization | Complete | Phase 1.1 through 1.4 are complete. Cypress was not run in this session because the local Cypress installation has a known host issue and the user requested not to run or repair it. |
| Phase 2 - Cache Modularization | Complete for Phase 3 handoff | Phase 2.1 through 2.3 are complete per `01-roadmap.md`. Detailed cache follow-ups in `03-cache-modularization.md` remain useful future hardening work. |
| Phase 3 - Capacitor Bridge Foundation | In progress | Phase 3.1 is complete. Phase 3.2 should select the native playback backend only inside Capacitor iOS with web fallback elsewhere. |
| Phase 4 - Complete iOS Native Implementation | Not started | Must finish before Android begins. |
| Phase 5 - Android Platform Support | Blocked | Do not add `@capacitor/android` or Android project files yet. |
| Phase 6 - Stabilization | Not started | Runs after platform implementation work. |

## Verification Log

Record test commands and outcomes here as the roadmap progresses.

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-16 | `biome lint` | Passed | Ran automatically during commit `000f1a29`. |
| 2026-05-16 | `pnpm run test:unit` | 482 passed (baseline) | Pre-change baseline: all existing tests pass. No flaky tests found. |
| 2026-05-16 | `pnpm run test:unit` | 570 passed | Added queue-utils tests (88) and platform tests (16). All pass. |
| 2026-05-16 | `biome lint` | Passed | Clean after Phase 0.1 changes. |
| 2026-05-17 | `pnpm run test:unit` | 587 passed | Added capabilities tests (17). All pass. |
| 2026-05-17 | `biome lint` | Passed | Clean after Phase 0.2 changes. |
| 2026-05-17 | `pnpm run build` | Succeeded | Web build passes with no errors. |
| 2026-05-17 | `pnpm run test:unit` | 646 passed | Added queue-transitions tests (59). All pass. |
| 2026-05-17 | `biome lint` | Passed | Clean after Phase 1.1 changes. |
| 2026-05-17 | `pnpm run build` | Succeeded | Web build passes with no errors. |
| 2026-05-17 | `pnpm vitest run src/utils/capabilities.test.ts` | 21 passed | Phase 0 review fix: native runtime now requires Capacitor native platform detection; iOS web keeps system-volume behavior. |
| 2026-05-17 | `pnpm run test:unit` | 650 passed | Full unit suite after Phase 0 runtime detection correction. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 0 runtime detection correction. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm vitest run src/player/playback/playback-backend.test.ts` | 7 passed | Phase 1.2 backend contract and web adapter tests. |
| 2026-05-17 | `pnpm run test:unit` | 657 passed | Full unit suite after Phase 1.2. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 1.2. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite warnings remain. |
| 2026-05-17 | `pnpm exec cypress run --component --spec src/app/components/player/player.cy.tsx,src/app/components/player/audio.cy.tsx` | Not run to completion | Cypress has a known local host issue on this machine; user instructed not to run Cypress or spend time repairing it. |
| 2026-05-17 | `pnpm vitest run src/player/playback/playback-backend.test.ts src/player/playback/session.test.ts` | 20 passed | Phase 1.3 backend and playback session tests. |
| 2026-05-17 | `pnpm run test:unit` | 670 passed | Full unit suite after Phase 1.3. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 1.3. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite warnings remain. |
| 2026-05-17 | `pnpm vitest run src/store/player/persistence.test.ts` | 5 passed | Phase 1.4 persistence and migration tests. |
| 2026-05-17 | `pnpm vitest run src/store/player/*.test.ts src/store/player/persistence.test.ts` | 151 passed | Existing player store tests plus persistence tests after Phase 1.4. |
| 2026-05-17 | `pnpm run test:unit` | 675 passed | Full unit suite after Phase 1.4. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 1.4. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/service/cache/contracts/fakes.test.ts src/service/cache/audio-url-resolver.test.ts src/service/cache/cache-storage.test.ts src/service/cache/persist-meta.test.ts src/service/cache/audio-cache-queue.test.ts` | 48 passed | Phase 2.1 cache contract fakes, URL resolver, storage, metadata persistence, and queue tests. |
| 2026-05-17 | `pnpm run test:unit` | 687 passed | Full unit suite after Phase 2.1. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 2.1; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts src/service/cache/audio-url-resolver.test.ts` | 28 passed | Phase 2.2 resolver tests covered cache hit, cache miss, stale index, index-not-loaded recovery, synthetic metadata, native-file resolution, and legacy cache manager compatibility. |
| 2026-05-17 | `pnpm run test:unit` | 693 passed | Full unit suite after Phase 2.2. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 2.2; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/service/cache/contracts/fakes.test.ts src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts` | 34 passed | Phase 2.3: `FakeNativeCacheAdapter` tests (5), `getNativeCacheAdapter` platform-selection tests (11), resolver integration tests including `NativeCacheAdapter`-backed resolution and native-over-blob priority (2), plus existing contract and resolver tests (16). |
| 2026-05-17 | `pnpm run test:unit` | 711 passed | Full unit suite after Phase 2.3. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 2.3; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/facade.test.ts` | 6 passed | Phase 3.1 facade registration, web fallback, iOS availability, missing-plugin fallback, and typed listener wrappers. |
| 2026-05-17 | `pnpm run test:unit` | 717 passed | Full unit suite after Phase 3.1. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 3.1; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |

### Phase 0.1 - Baseline Test Coverage Added

**`src/store/player/queue-utils.test.ts`** (88 tests):
- `getCurrentSong`: empty list, context song, user queue song, user queue fallback
- `getEffectiveQueue`: context-only, interleaved with user queue
- `getEffectiveIndex`: context index, user queue offset
- `hasNextEffectiveSong`: more context songs, last song loop off/all, user queue, in-user-queue
- `hasPrevEffectiveSong`: start of queue, playedUserQueueHistory, isInUserQueue, context index>0
- `isPlayingOneSong`: single song, multiple songs, one context + user queue, empty
- `findSongTier`: user queue, playedUserQueueHistory, context queue, not found
- `dedupAgainstExisting`: removes existing, dedupes within incoming, empty existing, all exist
- `emptyContextQueue`: default values, overrides
- `initSonglistState`: all fields initialized correctly
- `clearSonglistState`: resets all fields to defaults
- `applyShuffleOn`: sets shuffle flag, saves originals, keeps current position, no-op for single song, shuffles user queue
- `applyShuffleOff`: restores originals, resets index to 0 when not found, restores user queue, clears shuffle state
- `trimQueueToWindow`: under max, centered window, empty, start, end of large queue
- `normalizeSourceId`: null, undefined, album, playlist, radio, unknown type, typed pass-through
- `reshuffleContextForWrap`: no-op when not shuffling, no-op for single song, reshuffles keeping first, moves last played to end
- `resetPlaybackState`: resets all playback fields
- `applyStarToAllLists`: updates context, user, currentSong; unstars; no-ops on non-matching
- `LoopState` enum: Off=0, All=1, One=2
- `hasAnySongs`: context, user queue, both empty

**`src/utils/platform.test.ts`** (16 tests):
- `isIOS`: iPhone, iPad, iPod platforms; iPhone/iPad user agents; Mac with touch (iPad iOS13+); Windows; Mac without touch
- `isIPad`: iPad platform; Mac with touch; iPhone returns false; Windows
- `isAndroid`: Android user agent; non-Android
- `isSafari`: Safari UA; Chrome UA; Firefox UA

### Phase 0.2 - Platform Capability Detection

**`src/utils/capabilities.ts`** - New module:
- `PlatformRuntime` type: `"web" | "electron" | "capacitor-ios" | "capacitor-android"`
- `PlaybackCapabilities` interface: `canSetVolume`, `requiresSystemVolume`, `supportsWebAudioReplayGain`, `supportsNativePlayback`, `supportsBackgroundPlayback`
- `DesktopCapabilities` interface: `hasDesktopIntegration`, `hasLanControl`, `hasMiniPlayer`, `hasNativeThemeSync`, `hasUpdateCheck`
- `detectRuntime()`: uses `isDesktop()` plus Capacitor native platform detection (`isNativePlatform()`/`getPlatform()`) to determine runtime. iOS and Android browser/PWA sessions remain `web`.
- `getRuntime()`: cached runtime detection
- `resetRuntimeCache()`: testability hook
- `getPlaybackCapabilities()`: returns capability set for current runtime, with iOS web/PWA preserving system-volume behavior (`canSetVolume: false`, `requiresSystemVolume: true`)
- `getDesktopCapabilities()`: returns desktop integration capabilities
- `isIOS()` is still exported from `platform.ts` and used internally by `getPlaybackCapabilities()` for web/PWA volume behavior

**Migrated call sites** (7 total):
- `playback-actions.ts`: `setVolume` and `handleVolumeWheel` now use `!canSetVolume` instead of `isIOS()`
- `audio.tsx`: volume gain now uses `requiresSystemVolume` instead of `isIOS()`
- `volume.tsx` (PlayerVolume + VolumeSlider): display volume and disabled state use `requiresSystemVolume`
- `fullscreen/volume-bar.tsx`: display volume, mute button, and scroll handling use `requiresSystemVolume`
- `use-mute-toggle.ts`: mute toggle uses `!canSetVolume` instead of `isIOS()`

**`src/utils/capabilities.test.ts`** (21 tests):
- `detectRuntime`: electron, iOS browser as web, Android browser as web, native Capacitor iOS, native Capacitor Android, web, priority (electron over native ios/android)
- `getRuntime` caching: caches result, resets after `resetRuntimeCache()`
- `getPlaybackCapabilities`: web, iOS web system-volume behavior, electron, native Capacitor iOS, native Capacitor Android capabilities; interface shape
- `getDesktopCapabilities`: no bridge, with bridge, LAN control detection
- Consistency with `isIOS()` for volume control

### Phase 1.1 - Extract Pure Queue Transitions

**`src/store/player/queue-transitions.ts`** - New module with 13 pure transition functions:

All functions accept plain `ISongList` state and return a `QueueTransition` result
(or `null` for no-op/invalid cases). They do not depend on Zustand, React, or any
side effects. This makes queue behavior fully testable without a store.

- `QueueTransition` interface: `{ songlist, resetProgress, seekToStart, isPlaying, isTransitioning }`
- `transitionNextSong(songlist, loopState)`: handles next-song logic including user queue consumption, user queue entry, LoopState.One seek-to-start, normal advance, and LoopState.All wrap-around
- `transitionPrevSong(songlist, currentProgress, loopState)`: handles previous-song logic including seek-to-start threshold, history restoration from `playedUserQueueHistory`, user queue drop-back, and context index decrement
- `transitionRemoveFromContextQueue(songlist, songId)`: removes a song from the context queue with proper index adjustment (considers current position and user queue status)
- `transitionRemoveFromUserQueue(songlist, songId)`: removes a song from the user queue, exits user queue mode if needed
- `transitionReorderQueue(songlist, fromIndex, toIndex)`: handles drag-and-drop reordering within/between user queue and upcoming context tiers
- `transitionEnterUserQueueMode(songlist, userQueueIndex)`: enters user queue at a specific position, pushing songs before the index into played history
- `transitionClearUserQueue(songlist)`: clears user queue and history, exits user queue mode
- `transitionHandleSongEnded(songlist, loopState)`: returns `{ action: "playNext" | "seekToStart" | "stop" }` without performing side effects
- `transitionSetSongList(songlist, songs, index, sourceId, sourceName, shuffle, startHistory, shuffleFn, pickStartIndex)`: sets a new context queue, handling shuffle initialization and windowing
- `transitionPlayFromQueue(songlist, songs, index, sameList)`: jumps to a position within an existing or new context queue
- `transitionPlaySong(songlist, song, sourceName)`: creates a single-song context queue
- `transitionRemoveSongFromQueue(songlist, songId, tier)`: dispatches to user or context removal
- `transitionUpdatePrevNextFlags(songlist, loopState)`: returns hasPrev/hasNext flags
- `PREV_SEEK_THRESHOLD` exported constant (3 seconds)
- `cloneSonglist(sl)` internal helper for deep-cloning `ISongList`

**`src/store/player/queue-transitions.test.ts`** (59 tests):
- `transitionNextSong` (9 tests): no next song returns null, advances context index, seekToStart on LoopState.One, wraps with LoopState.All, enters user queue, consumes user queue song, drops back to context when last user song consumed, wraps context on LoopState.All when last user song consumed, advances within user queue
- `transitionPrevSong` (8 tests): seekToStart when progress exceeds threshold, no seek at threshold, no previous returns null, decrements context index, restores from playedUserQueueHistory, decrements context index when restoring from history and not in user queue, preserves context index when restoring from history in user queue, drops back to context queue from user queue
- `transitionRemoveFromContextQueue` (7 tests): removes before current adjusting index, removes current song, removes after current, returns null for empty queue, returns null for not found, adjusts index in user queue mode, removes from original context songs
- `transitionRemoveFromUserQueue` (4 tests): removes a song, exits user queue mode on last song removal, stays in user queue removing non-first, returns null for not found
- `transitionReorderQueue` (5 tests): reorders within user queue, reorders within upcoming context, moves from user queue to upcoming context, moves from upcoming context to user queue, returns null for same index
- `transitionEnterUserQueueMode` (4 tests): enters at specified index, enters at index 0, returns null for out-of-range, returns null for negative index
- `transitionClearUserQueue` (2 tests): clears queue and exits mode, does not set isInUserQueue false when not in mode
- `transitionHandleSongEnded` (5 tests): returns playNext when has next, returns seekToStart on LoopState.One with no next, returns playNext on LoopState.One with user queue, returns stop at last song with no loop, returns playNext on LoopState.All, returns seekToStart for LoopState.One when in user queue with no remaining
- `transitionUpdatePrevNextFlags` (2 tests): returns hasPrev/hasNext flags, returns hasPrev true in user queue
- `transitionSetSongList` (4 tests): sets context queue, sets shuffle mode, trims large lists, clears existing user queue and radio list
- `transitionPlayFromQueue` (4 tests): updates index on same list, replaces context queue, returns null for empty, clamps out-of-range index
- `transitionPlaySong` (3 tests): creates single-song context queue, uses provided sourceName, sets sourceId to null
- `PREV_SEEK_THRESHOLD` (1 test): validates constant value

### Phase 2.3 - Prepare Native Cache Access

**`src/service/cache/contracts/index.ts`** - Extended with `NativeCacheAdapter`:
- `NativeCacheAdapter extends NativeFileResolver`: adds `storeAudioFile(songId, data, contentType)`, `getAudioFileSize(songId)`, and `evictAudioFile(songId)`
- Contract lets native platforms store audio bytes to filesystem, resolve song IDs to native-playable URIs, query stored file sizes for eviction, and remove files during cache eviction
- Web, iOS, and Android each get their own adapter implementation (iOS in Phase 4, Android in Phase 5)

**`src/service/cache/contracts/fakes.ts`** - New `FakeNativeCacheAdapter`:
- Stores files in an in-memory `Map` with auto-incrementing URI paths
- `storeAudioFile`: creates a `NativeCachedAudioFile` with `uri`, `contentType`, `sizeBytes`, `lastModifiedAt`
- `resolveAudioFile`: returns stored file metadata (without the Blob data)
- `getAudioFileSize`: returns `sizeBytes` or `null`
- `deleteAudioFile` / `evictAudioFile`: remove from the map

**`src/service/cache/native-cache-adapter.ts`** - Platform-aware factory:
- `WebNullNativeCacheAdapter`: returns `null`/`false` from read operations, throws on `storeAudioFile` (web cannot store native files)
- `getNativeCacheAdapter()`: uses `getRuntime()` to choose adapter; on `capacitor-ios` throws "not yet implemented" (Phase 4), on `capacitor-android` throws "not available until Phase 5"
- `_resetNativeCacheAdapter()` and `_setNativeCacheAdapterForTests()` for test injection

**`src/service/cache/audio-source/index.ts`** - Updated:
- `audioSourceResolver` now passes `getNativeCacheAdapter()` as `nativeFileResolver`, so native file resolution is wired through the platform-aware factory

**`src/service/cache/native-cache-adapter.test.ts`** (11 tests):
- `getNativeCacheAdapter` on web: returns null adapter, resolve returns null, size returns null, delete/evict return false, store throws
- `getNativeCacheAdapter` on capacitor-ios: throws "not yet implemented"
- `getNativeCacheAdapter` on capacitor-android: throws "not available until Phase 5"
- Adapter instance caching and reset
- Test adapter injection via `_setNativeCacheAdapterForTests`

**`src/service/cache/contracts/fakes.test.ts`** - Added 5 `FakeNativeCacheAdapter` tests:
- Store, resolve, and report size
- Null returns for missing files
- Delete and evict operations
- False returns for missing file deletion/eviction
- Overwrite on store

**`src/service/cache/audio-source/index.test.ts`** - Added 2 tests:
- Resolver returns native-file descriptor when `NativeCacheAdapter` has stored a file
- Resolver prefers native-file over cached blob when both exist

## Handoff Notes

- Phase 1.2 is complete. Playback sources, backend events, and the web
  `HTMLAudioElement` backend live in `src/player/playback/`.
- Phase 1.3 is complete. `PlaybackSession` owns retry/source-change/pending
  resume/play-pause/end decisions, and React audio components delegate to it.
- Phase 1.4 is complete. `src/store/player/index.ts` is now the coordinator,
  with store creation in `store.ts`, public hooks in `selectors.ts`,
  persistence/migrations/IDB flushing in `persistence.ts`, and side-effect
  subscriptions in `subscriptions.ts`.
- Phase 2.1 is complete. Cache contracts live in
  `src/service/cache/contracts/`, test fakes live in
  `src/service/cache/contracts/fakes.ts`, the stream/cache URL builder now
  lives in `src/service/cache/audio-url-resolver.ts`, and the current Zustand
  cache index adapter lives in `src/service/cache/cache-index-adapter.ts`.
- Phase 2.2 is complete. Typed audio source resolution lives in
  `src/service/cache/audio-source/`, `useAudioSource(songId)` is the new typed
  hook, `useCachedAudioUrl(songId)` remains as a compatibility wrapper, and
  `AudioPlayer` now receives typed song source descriptors while still loading
  a string `src` for web playback.
- Phase 2.3 is complete. `NativeCacheAdapter` contract extends
  `NativeFileResolver` with `storeAudioFile`, `getAudioFileSize`, and
  `evictAudioFile`. `native-cache-adapter.ts` provides a platform-aware factory
  (`getNativeCacheAdapter()`) that returns a null adapter on web and throws on
  native platforms (iOS/Android implementations deferred to Phase 4/5). The
  `CacheAudioSourceResolver` now uses this factory as its default
  `nativeFileResolver`. `FakeNativeCacheAdapter` is available for tests.
- Phase 3.1 is complete. The TypeScript Capacitor native audio facade lives in
  `src/native/audio/`. It registers `AonsokuNativeAudio`, defines typed source,
  metadata, queue/control, and event contracts, provides unavailable-safe web
  behavior, and exposes availability/listener helpers for mocked and future
  native backends.
- Public imports from `@/store/player.store` remain stable.
- Public imports of `buildAudioUrl` from `@/service/cache` remain stable.
- Cypress component tests were intentionally not run after user instruction:
  this machine has a known Cypress host issue, and Cypress repair is out of
  scope for this roadmap work.
- The next implementation session should continue Phase 3.2 from
  `01-roadmap.md`: route Capacitor iOS to the native playback backend while
  keeping web/Electron on the web backend and falling back if the plugin is
  unavailable.
- Keep every sub-step small, tested, and committed independently.
- Keep Android blocked until the iOS done criteria in `00-requirements.md` and
  `04-ios-native-implementation.md` are satisfied.
