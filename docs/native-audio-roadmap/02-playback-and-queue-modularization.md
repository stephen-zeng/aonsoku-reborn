# Playback And Queue Modularization Plan

## Current Pain Points

- `AudioPlayer` owns too many responsibilities: source changes, retry logic,
  ReplayGain setup, native HTML audio calls, progress guarding, buffering, and
  event forwarding.
- `Player` coordinates UI, refs, progress, scrobbling, preloading, cached URLs,
  and playback events in one component.
- The player store is already split into action modules, but the queue logic is
  still tightly coupled to Zustand drafts and remote-control side effects.
- Platform behavior is scattered through direct `isIOS()` checks.

## Target Shape

Keep existing public imports stable while introducing a domain layer:

- `src/player/queue/`
  - Pure queue models and transition functions.
  - Queue selectors.
  - Queue tests independent of Zustand.
- `src/player/playback/`
  - Playback backend interface.
  - Playback session/orchestrator.
  - Web HTML audio backend.
  - Native backend facade for Capacitor.
- `src/player/platform/`
  - Runtime capability detection.
  - Backend selection.
- `src/store/player/`
  - Zustand adapter, persistence, migrations, selectors, and action wrappers.
- `src/app/components/player/`
  - UI components and thin backend hosts only.

The exact file names may be adjusted during implementation, but the dependency
direction should stay stable:

React UI -> store/hooks -> player domain -> backend/cache/platform adapters

The domain modules must not import React components.

## Step 1 - Queue Baseline Tests

Implementation:

- Add focused tests that describe the existing queue behavior before moving
  code.
- Cover normal list playback, single-song playback, shuffle start behavior,
  repeat-all wrap, repeat-one end behavior, previous threshold behavior, user
  queue insertion, user queue playback, reorder, remove, clear, and radio mode.
- Use existing song fixtures or lightweight fixture builders.

Tests:

- Vitest queue tests.
- Existing player Cypress tests for button disabled states.

Commit:

- `test(queue): capture current queue behavior`

## Step 2 - Extract Queue Model

Implementation:

- Create pure queue state types that map cleanly to the existing `ISongList`.
- Add conversion helpers only if needed.
- Move helpers from `queue-utils.ts` into pure modules where they do not need
  Zustand.
- Keep current persisted `ISongList` shape unchanged unless a migration is
  explicitly added.

Tests:

- Vitest for helpers and conversion.
- Existing player store tests.

Commit:

- `refactor(queue): extract queue model helpers`

## Step 3 - Extract Queue Transitions

Implementation:

- Move queue actions into pure transition functions that accept current queue
  state and command input, then return next queue state and playback effects.
- Represent side effects as typed effects, for example `resetProgress`,
  `startPlayback`, `sendRemoteCommand`, or `setMediaType`.
- Keep Zustand actions responsible for applying returned state and executing
  side effects.

Tests:

- Vitest for every transition.
- Store adapter tests for key actions.

Commit:

- `refactor(queue): move transitions out of zustand actions`

## Step 4 - Define Playback Backend Contract

Implementation:

- Add a backend interface for:
  - `load(source)`
  - `play()`
  - `pause()`
  - `stop()`
  - `seek(seconds)`
  - `setLoop(enabled)`
  - `setVolume(value)`
  - `preload(source)`
  - `dispose()`
  - event subscription for progress, duration, buffering, ended, play, pause,
    and error
- Add source descriptors for stream URL, blob URL, native file, and radio URL.
- Build a web backend around `HTMLAudioElement`.
- Keep native backend as a facade until iOS implementation starts.

Tests:

- Vitest contract tests with a fake backend.
- Cypress component tests confirming current controls still call play, pause,
  seek, and volume behavior.

Commit:

- `refactor(player): add playback backend interface`

## Step 5 - Extract Playback Session

Implementation:

- Move retry state, retry timers, range fallback, pending resume position,
  source generation, buffering state, and duration/progress syncing into a
  playback session module or hook.
- Keep React lifecycle wiring small and explicit.
- Keep ReplayGain setup behind the web backend path.

Tests:

- Vitest for retry state transitions and pending resume behavior.
- Existing `audio.cy.tsx` recovery tests.
- Component test for "pause during retry must not auto-play".

Commit:

- `refactor(player): extract playback session state`

## Step 6 - Refactor Preloading

Implementation:

- Replace direct `new Audio()` usage in `use-preload-audio.ts` with backend
  preloading when available.
- Keep web preloading behavior unchanged.
- Disable or adapt preloading for native backends if native playback handles
  queue prebuffering internally.

Tests:

- Vitest for next-song selection.
- Mock backend test for preload calls.

Commit:

- `refactor(player): route preloading through playback backend`

## Step 7 - Migrate Platform Checks

Implementation:

- Replace scattered `isIOS()` behavior with runtime capabilities:
  - `canSetAppVolume`
  - `supportsWebAudioReplayGain`
  - `supportsNativePlayback`
  - `requiresSystemVolume`
  - `supportsBackgroundPlayback`
- Preserve current iOS volume behavior.

Tests:

- Vitest for capabilities.
- Component tests for disabled volume controls on iOS-like environments.

Commit:

- `refactor(platform): use playback capabilities in player UI`

## Step 8 - Store Cleanup

Implementation:

- Keep `src/store/player.store.ts` as the stable re-export surface.
- Move persistence, migration, IDB flushing, subscriptions, and cleanup into
  dedicated modules.
- Keep action modules thin once queue and playback behavior lives in domain
  modules.

Tests:

- Store migration tests.
- Existing store and component tests.

Commit:

- `refactor(player-store): isolate persistence and subscriptions`

## Done Criteria

- React player components no longer own playback business logic.
- Queue transitions can be tested without React or Zustand.
- Playback orchestration can run against fake, web, and native backends.
- Existing web and Electron tests still pass.
- Public imports from `@/store/player.store` remain stable.
