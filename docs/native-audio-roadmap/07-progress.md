# Progress

This document tracks the completed work for the native audio roadmap. Update it
after every completed sub-step, including verification results and the git
commit that contains the change.

## Current Status

- Roadmap status: Phase 0 in progress.
- Active implementation phase: Phase 0 - Baseline And Guardrails.
- Next step: Phase 0.2, add platform capability detection.
- Android status: blocked until the full iOS native implementation is complete.

## Completed Work

| Date | Step | Summary | Verification | Commit |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Requirements and roadmap documentation | Created the native audio roadmap document set covering requirements, phase order, playback/queue modularization, cache modularization, iOS-native implementation, Android gating, and the test/commit protocol. | Documentation-only change. `biome lint` ran during commit and passed. | `000f1a29 chore(docs): add native audio implementation roadmap` |
| 2026-05-16 | Phase 0.1 - Capture baseline behavior | Ran existing unit tests (482 passing, 0 failing, 0 flaky). Added baseline regression tests for queue utilities (88 tests) and platform detection (16 tests). Total test count went from 482 to 570. All tests pass, lint clean. | `pnpm run test:unit` 570/570 passed. `biome lint` passed. | `2bf22f38 test(player): capture playback and queue baseline` |

## Phase Checklist

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Baseline And Guardrails | Phase 0.1 complete | Phase 0.2 (platform capability detection) is next. |
| Phase 1 - Playback And Queue Modularization | Not started | Blocked on Phase 0 baseline. |
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

## Handoff Notes

- Phase 0.1 is complete. All 570 tests pass.
- The next implementation session should begin with Phase 0.2 from
  `01-roadmap.md`: centralize runtime capability detection.
- Keep every sub-step small, tested, and committed independently.
- Keep Android blocked until the iOS done criteria in `00-requirements.md` and
  `04-ios-native-implementation.md` are satisfied.