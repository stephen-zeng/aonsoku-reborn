# Progress

This document tracks the completed work for the native audio roadmap. Update it
after every completed sub-step, including verification results and the git
commit that contains the change.

## Current Status

- Roadmap status: Phase 1 in progress.
- Active implementation phase: Phase 1 - Playback And Queue Modularization.
- Next step: Phase 1.2, define the playback backend contract.
- Android status: blocked until the full iOS native implementation is complete.

## Completed Work

| Date | Step | Summary | Verification | Commit |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Requirements and roadmap documentation | Created the native audio roadmap document set covering requirements, phase order, playback/queue modularization, cache modularization, iOS-native implementation, Android gating, and the test/commit protocol. | Documentation-only change. `biome lint` ran during commit and passed. | `000f1a29 chore(docs): add native audio implementation roadmap` |
| 2026-05-16 | Phase 0.1 - Capture baseline behavior | Ran existing unit tests (482 passing, 0 failing, 0 flaky). Added baseline regression tests for queue utilities (88 tests) and platform detection (16 tests). Total test count went from 482 to 570. All tests pass, lint clean. | `pnpm run test:unit` 570/570 passed. `biome lint` passed. | `2bf22f38 test(player): capture playback and queue baseline` |
| 2026-05-17 | Phase 0.2 - Add platform capability detection | Created `src/utils/capabilities.ts` with `detectRuntime()`, `getRuntime()`, `getPlaybackCapabilities()`, and `getDesktopCapabilities()`. Migrated all 7 `isIOS()` call sites to capability queries (`canSetVolume`, `requiresSystemVolume`). Added 17 capability tests. Total 587 tests pass. Build succeeds. | `pnpm run test:unit` 587/587 passed. `biome lint` passed. `pnpm run build` succeeded. | `7e35d40e refactor(platform): centralize runtime capability detection` |
| 2026-05-17 | Phase 1.1 - Extract pure queue transitions | Created `src/store/player/queue-transitions.ts` with 13 pure transition functions extracted from `queue-actions.ts`. Added 59 tests in `queue-transitions.test.ts`. Total 646 tests pass. Build succeeds. | `pnpm run test:unit` 646/646 passed. `biome lint` passed. `pnpm run build` succeeded. | `cacd277b refactor(queue): extract pure queue transitions` |

## Phase Checklist

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Baseline And Guardrails | Complete | Both Phase 0.1 and 0.2 done. |
| Phase 1 - Playback And Queue Modularization | In progress | Phase 1.1 done. Next: Phase 1.2 define playback backend contract. |
| Phase 2 - Cache Modularization | Not started | Should follow or coordinate with playback source descriptor work. |
| Phase 3 - Capacitor Bridge Foundation | Not started | No native implementation until contracts are stable. |
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
- `detectRuntime()`: uses `isDesktop()`, `isIOS()`, `isAndroid()` to determine runtime
- `getRuntime()`: cached runtime detection
- `resetRuntimeCache()`: testability hook
- `getPlaybackCapabilities()`: returns capability set for current runtime
- `getDesktopCapabilities()`: returns desktop integration capabilities
- `isIOS()` is still exported from `platform.ts` and used internally by `detectRuntime()`

**Migrated call sites** (7 total):
- `playback-actions.ts`: `setVolume` and `handleVolumeWheel` now use `!canSetVolume` instead of `isIOS()`
- `audio.tsx`: volume gain now uses `requiresSystemVolume` instead of `isIOS()`
- `volume.tsx` (PlayerVolume + VolumeSlider): display volume and disabled state use `requiresSystemVolume`
- `fullscreen/volume-bar.tsx`: display volume, mute button, and scroll handling use `requiresSystemVolume`
- `use-mute-toggle.ts`: mute toggle uses `!canSetVolume` instead of `isIOS()`

**`src/utils/capabilities.test.ts`** (17 tests):
- `detectRuntime`: electron, ios, android, web, priority (electron over ios/android)
- `getRuntime` caching: caches result, resets after `resetRuntimeCache()`
- `getPlaybackCapabilities`: web, electron, ios, android capabilities; interface shape
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

## Handoff Notes

- Phase 1.1 is complete. All 646 tests pass.
- The pure transition functions in `queue-transitions.ts` currently coexist
  alongside the Zustand-based actions in `queue-actions.ts`. The Zustand
  actions have not yet been refactored to call the pure transitions.
- The next implementation session should begin with Phase 1.2 from
  `01-roadmap.md` and `02-playback-and-queue-modularization.md`: define the
  playback backend contract.
- Before Phase 1.2, the Zustand actions in `queue-actions.ts` should be
  refactored to call the pure transitions from `queue-transitions.ts`, making
  the actions thin adapters. This is part of Step 3 in the detailed plan.
- Keep every sub-step small, tested, and committed independently.
- Keep Android blocked until the iOS done criteria in `00-requirements.md` and
  `04-ios-native-implementation.md` are satisfied.