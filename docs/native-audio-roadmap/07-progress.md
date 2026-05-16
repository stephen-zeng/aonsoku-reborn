# Progress

This document tracks the completed work for the native audio roadmap. Update it
after every completed sub-step, including verification results and the git
commit that contains the change.

## Current Status

- Roadmap status: Phase 0 complete.
- Active implementation phase: Phase 0 - Baseline And Guardrails.
- Next step: Phase 1.1, extract pure queue logic.
- Android status: blocked until the full iOS native implementation is complete.

## Completed Work

| Date | Step | Summary | Verification | Commit |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Requirements and roadmap documentation | Created the native audio roadmap document set covering requirements, phase order, playback/queue modularization, cache modularization, iOS-native implementation, Android gating, and the test/commit protocol. | Documentation-only change. `biome lint` ran during commit and passed. | `000f1a29 chore(docs): add native audio implementation roadmap` |
| 2026-05-16 | Phase 0.1 - Capture baseline behavior | Ran existing unit tests (482 passing, 0 failing, 0 flaky). Added baseline regression tests for queue utilities (88 tests) and platform detection (16 tests). Total test count went from 482 to 570. All tests pass, lint clean. | `pnpm run test:unit` 570/570 passed. `biome lint` passed. | `2bf22f38 test(player): capture playback and queue baseline` |
| 2026-05-17 | Phase 0.2 - Add platform capability detection | Created `src/utils/capabilities.ts` with `detectRuntime()`, `getRuntime()`, `getPlaybackCapabilities()`, and `getDesktopCapabilities()`. Migrated all 7 `isIOS()` call sites to capability queries (`canSetVolume`, `requiresSystemVolume`). Added 17 capability tests. Total 587 tests pass. Build succeeds. | `pnpm run test:unit` 587/587 passed. `biome lint` passed. `pnpm run build` succeeded. | `7e35d40e refactor(platform): centralize runtime capability detection` |

## Phase Checklist

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Baseline And Guardrails | Complete | Both Phase 0.1 and 0.2 done. |
| Phase 1 - Playback And Queue Modularization | Not started | Next: Phase 1.1 extract pure queue logic. |
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

## Handoff Notes

- Phase 0 is complete. All 587 tests pass.
- The next implementation session should begin with Phase 1.1 from
  `01-roadmap.md` and `02-playback-and-queue-modularization.md`: extract pure
  queue logic.
- Keep every sub-step small, tested, and committed independently.
- Keep Android blocked until the iOS done criteria in `00-requirements.md` and
  `04-ios-native-implementation.md` are satisfied.
- The `isIOS()` function is still exported from `platform.ts` and used
  internally by `detectRuntime()`. It should remain available until all
  remaining call sites (none left) are migrated.