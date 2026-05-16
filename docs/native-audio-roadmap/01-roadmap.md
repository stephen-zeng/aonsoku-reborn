# Implementation Roadmap

## Phase 0 - Baseline And Guardrails

### 0.1 Capture baseline behavior

- Run the current relevant unit and component tests.
- Identify existing flaky tests before changing implementation.
- Add missing regression tests for behavior that will be refactored first.

Expected tests:

- `pnpm run test:unit`
- Targeted Cypress component tests for player/audio behavior when practical.

Commit:

- `test(player): capture playback and queue baseline`

### 0.2 Add platform capability detection

- Introduce a single runtime capability module for web, Electron, Capacitor iOS,
  and later Capacitor Android.
- Keep existing `isIOS()` behavior working until all call sites migrate.
- Add tests for browser, iOS-like, and Capacitor-like detection.

Expected tests:

- Vitest for platform capability helpers.

Commit:

- `refactor(platform): centralize runtime capability detection`

## Phase 1 - Playback And Queue Modularization

### 1.1 Extract pure queue logic

- Move queue transitions into pure functions.
- Keep Zustand actions as adapters.
- Cover set list, shuffle, repeat, next, previous, user queue, reorder, radio,
  and clear behavior.

Expected tests:

- Vitest unit tests for queue transitions.
- Existing player component tests for visible control state.

Commit:

- `refactor(queue): extract pure queue transitions`

### 1.2 Define the playback backend contract

- Add a TypeScript interface for load, play, pause, seek, stop, loop, preload,
  progress events, buffering events, completion, and errors.
- Add a web backend that wraps `HTMLAudioElement`.
- Keep the current UI mounted audio behavior working through the backend.

Expected tests:

- Vitest contract tests using fake backends.
- Cypress component tests for play/pause/progress behavior.

Commit:

- `refactor(player): introduce playback backend contract`

### 1.3 Extract playback orchestration

- Move retry, source changes, progress syncing, buffering, duration updates, and
  end handling out of `AudioPlayer`.
- Keep ReplayGain setup isolated from the backend contract.
- Make `AudioPlayer` a thin web backend host.

Expected tests:

- Vitest for playback session state transitions.
- Existing `audio.cy.tsx` retry recovery tests.

Commit:

- `refactor(player): isolate playback session orchestration`

### 1.4 Split player store responsibilities

- Keep `@/store/player.store` as the public import surface.
- Move persistence, migrations, IDB flushing, selectors, playback actions, queue
  actions, UI actions, remote-control actions, and settings actions into clear
  modules.
- Avoid changing persisted schema unless a migration is included.

Expected tests:

- Existing player store tests.
- New migration tests if persisted shape changes.

Commit:

- `refactor(player-store): split persistence and action modules`

## Phase 2 - Cache Modularization

### 2.1 Define cache contracts

- Add interfaces for cache storage, cache index, metadata persistence, download
  queue, audio URL resolution, and native file resolution.
- Keep current Cache API/Dexie implementation behind these interfaces.

Expected tests:

- Vitest tests for contract behavior with fake storage.

Commit:

- `refactor(cache): define cache service contracts`

### 2.2 Split audio URL resolution

- Separate "which source should playback use?" from "how is this source played?"
- Return a typed source descriptor instead of only a string URL.
- Support stream URL, blob URL, and future native file URL sources.

Expected tests:

- Vitest for cache-hit, cache-miss, index-not-loaded, and stale-index cases.
- Component tests for player source changes if behavior changes.

Commit:

- `refactor(cache): isolate audio source resolution`

### 2.3 Prepare native cache access

- Add a native cache adapter contract without implementing Android.
- Implement iOS support only when Phase 4 begins.
- Keep browser cache behavior unchanged.

Expected tests:

- Mocked native adapter tests.

Commit:

- `refactor(cache): prepare native cache adapter`

## Phase 3 - Capacitor Bridge Foundation

### 3.1 Add TypeScript native plugin facades

- Add typed plugin registration and event wrappers.
- Keep the implementation mocked or unavailable-safe until iOS native code is
  added.
- No Android dependency is added in this phase.

Expected tests:

- Vitest with mocked Capacitor plugin registration.

Commit:

- `refactor(capacitor): add native audio facade`

### 3.2 Route Capacitor iOS to native backend

- Select the native playback backend only when running inside Capacitor iOS.
- Use web backend everywhere else.
- Add fallback handling if the native plugin is unavailable.

Expected tests:

- Vitest backend selection tests.
- Cypress component test with mocked native backend if practical.

Commit:

- `feat(ios): select native audio backend in Capacitor`

## Phase 4 - Complete iOS Native Implementation

See [04-ios-native-implementation.md](./04-ios-native-implementation.md).

iOS implementation must be completed before any Android project files or
dependencies are added.

## Phase 5 - Android Platform Support

See [05-android-platform-plan.md](./05-android-platform-plan.md).

This phase is blocked until Phase 4 is complete.

## Phase 6 - Stabilization

### 6.1 Cross-target regression pass

- Verify web playback.
- Verify Electron playback and Electron-specific integrations.
- Verify iOS native playback.
- Verify offline/cached playback across supported targets.

Expected tests:

- `pnpm run test:unit`
- `pnpm run test`
- `pnpm run build`
- `pnpm run electron:build`
- Native build commands for completed Capacitor targets.

Commit:

- `test(player): add cross-target playback regressions`

### 6.2 Documentation update

- Update developer docs with native playback architecture.
- Add troubleshooting notes for iOS and Android development.
- Document which tests to run for each target.

Expected tests:

- Documentation review only unless scripts change.

Commit:

- `chore(docs): document native playback architecture`
