# Requirements Clarification

## Goal

Modularize Aonsoku's audio playback, queue control, and cache-related code so
the app can share one stable TypeScript domain layer across web, Electron, and
Capacitor while using native implementations inside Capacitor.

The mobile order is strict:

1. Finish the modular foundation needed by all targets.
2. Implement the complete iOS Capacitor-native experience.
3. Only after iOS is complete, add Android platform support.

## Current Repository Facts

- The project already has a Capacitor iOS project under `ios/`.
- `capacitor.config.ts` points to `dist` and currently contains only basic app
  metadata.
- `package.json` includes `@capacitor/core`, `@capacitor/cli`,
  `@capacitor/ios`, and `@capacitor/keyboard`.
- `@capacitor/android` is not currently installed.
- `capacitor-plugins/` exists but is currently empty.
- Playback is centered on React components and hooks such as
  `src/app/components/player/audio.tsx`,
  `src/app/components/player/player.tsx`, `use-cached-audio.ts`, and
  `use-preload-audio.ts`.
- Queue and player state are exposed through `src/store/player.store.ts`, which
  re-exports `src/store/player/index.ts` and related action modules.
- Cache logic already has substantial separation under `src/service/cache/`,
  including cache storage, keys, smart downloads, workers, and tests.

## Functional Requirements

- Preserve the existing web and Electron playback behavior.
- Preserve the existing public player store API during migration where possible,
  especially imports from `@/store/player.store`.
- Separate queue state transitions from React, DOM audio elements, Capacitor,
  Electron, and cache storage.
- Separate playback orchestration from the concrete playback backend.
- Provide a shared playback backend interface that can be implemented by:
  - Web/Electron HTML audio.
  - Capacitor iOS native audio.
  - Capacitor Android native audio later.
- Keep React components focused on UI and event wiring.
- Keep cache orchestration independent from the physical storage implementation.
- Let Capacitor use platform-native implementations for playback, media
  controls, background audio, cache file access, and platform events when
  available.
- Keep browser/PWA behavior as a first-class fallback, not a degraded accident.

## iOS Completion Definition

iOS is complete only when all of the following are implemented and verified:

- Song playback from stream URLs.
- Radio stream playback.
- Play, pause, seek, next, previous, repeat, shuffle, and queue transitions.
- End-of-track handling that stays in sync with the TypeScript queue state.
- Background audio.
- Lock screen and Control Center controls.
- Now Playing metadata including title, artist, album, duration, elapsed time,
  playback state, and artwork when available.
- Remote command handling from headset, Bluetooth, lock screen, and Control
  Center controls.
- Audio session setup for playback.
- Interruption handling for calls, Siri, route changes, and app lifecycle
  transitions.
- Cached/offline audio playback through the shared cache abstraction.
- Error reporting from native playback back to TypeScript.
- Progress and buffering events delivered to the existing UI state.
- No Android project or Android dependency is added before this list is done.

## Android Completion Definition

Android is complete only after iOS completion, and only when the Android native
implementation reaches feature parity with the shared TypeScript contract.

At minimum Android must include:

- Capacitor Android project support.
- Native playback through an Android media engine.
- Android media session integration.
- Notification controls.
- Audio focus handling.
- Background playback service behavior.
- Cached/offline playback through the same TypeScript cache contract.
- Event parity with the iOS/native playback backend.

## Testing Requirements

Every sub-implementation must include tests when the changed behavior is
testable in the current toolchain:

- Pure queue/cache logic: Vitest unit tests.
- React player behavior: Cypress component tests.
- Native bridge TypeScript contracts: Vitest tests with mocked Capacitor
  plugins.
- iOS native code: Xcode build/test or the nearest available simulator/device
  verification when automated tests are not practical.
- Android native code later: Gradle build/test and emulator/device
  verification.

Each sub-step must run the relevant tests before commit. If a native test cannot
run on the current machine, record the reason in the step notes before
committing.

## Non-Goals For The First Pass

- Do not rewrite the UI design.
- Do not replace Zustand or React Query.
- Do not change Subsonic/Navidrome API semantics.
- Do not remove Electron-specific integrations such as Discord RPC, tray, LAN
  control, or mini-player support.
- Do not add Android before the iOS native implementation is complete.

## Assumptions To Confirm During Implementation

- iOS native volume control should follow iOS system behavior. The current web
  code already disables app-level volume changes on iOS.
- ReplayGain may remain web-only at first unless a native gain strategy is
  explicitly added.
- Native playback should still let the TypeScript queue state remain the source
  of truth unless a later step deliberately moves queue execution native-side.
- Existing cache metadata in IndexedDB/Dexie must remain migratable.
- Existing persisted player store data must remain migratable.
