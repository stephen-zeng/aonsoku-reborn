# iOS Native Implementation Plan

## Blocker Rule

This plan must be completed before any Android project or Android dependency is
added.

## Native Capability Scope

The iOS implementation should use native APIs for playback and system
integration when running inside Capacitor iOS:

- `AVPlayer` or an equivalent AVFoundation playback engine.
- `AVAudioSession` configured for playback.
- `MPRemoteCommandCenter` for remote controls.
- `MPNowPlayingInfoCenter` for lock screen and Control Center metadata.
- Native file access for cached/offline audio.
- Capacitor plugin events for playback state, progress, duration, buffering,
  ended, errors, remote commands, interruptions, and route changes.

## Proposed Plugin Surface

Create a local Capacitor plugin under `capacitor-plugins/`, for example:

- `capacitor-plugins/aonsoku-native-audio/`

The TypeScript facade should expose methods similar to:

- `load(source, metadata, options)`
- `play()`
- `pause()`
- `stop()`
- `seek({ position })`
- `setRepeatMode({ mode })`
- `setShuffle({ enabled })`
- `setQueue({ items, index })`
- `skipToNext()`
- `skipToPrevious()`
- `updateMetadata(metadata)`
- `preload(source)`
- `clear()`

The event surface should include:

- `playbackStateChanged`
- `progress`
- `durationChanged`
- `bufferingChanged`
- `ended`
- `error`
- `remoteCommand`
- `interruptionChanged`
- `routeChanged`

Exact names can change, but the TypeScript playback backend contract must not
be iOS-specific.

## Step 1 - Plugin Skeleton

Implementation:

- Create the local Capacitor plugin package.
- Add TypeScript definitions and registration helpers.
- Add iOS Swift plugin skeleton.
- Wire the app to include the local plugin without changing Android.
- Add unavailable-safe behavior for non-iOS runtimes.

Tests:

- Vitest for TypeScript facade registration and missing-plugin fallback.
- iOS build command if Xcode is available.

Commit:

- `feat(ios): add native audio plugin skeleton`

## Step 2 - Basic Native Playback

Implementation:

- Implement `load`, `play`, `pause`, `stop`, and `seek`.
- Support remote stream URLs from the existing Subsonic URL builder.
- Emit play, pause, progress, duration, ended, and error events.
- Route Capacitor iOS playback through the native backend.

Tests:

- Vitest backend tests with mocked native plugin.
- iOS simulator/device smoke test for one song.
- Cypress component test with mocked native backend if practical.

Commit:

- `feat(ios): implement native song playback`

## Step 3 - Queue And End Handling

Implementation:

- Connect native ended events to the shared TypeScript queue transitions.
- Implement next, previous, repeat, shuffle, and seek-to-start behavior through
  the shared backend contract.
- Decide whether native receives one item at a time or the full queue. Keep
  TypeScript queue state authoritative unless a later step explicitly changes
  that.

Tests:

- Vitest backend-session tests for native ended events.
- Queue transition tests must pass unchanged.
- iOS smoke test for next, previous, repeat-one, and repeat-all.

Commit:

- `feat(ios): connect native playback to queue controls`

## Step 4 - Radio Playback

Implementation:

- Support radio stream sources.
- Keep radio-specific retry and error behavior consistent with web playback.
- Ensure clearing radio playback resets native state.

Tests:

- Vitest source selection tests.
- iOS smoke test for radio play, pause, and error recovery.

Commit:

- `feat(ios): support native radio playback`

## Step 5 - Background Audio And Audio Session

Implementation:

- Enable the required iOS background audio capability.
- Configure `AVAudioSession` for playback.
- Handle interruptions and route changes.
- Keep playback state synced when the app backgrounds and foregrounds.

Tests:

- iOS build.
- Simulator/device checklist:
  - Background the app while playing.
  - Lock the device while playing.
  - Resume after interruption.
  - Switch audio route when possible.

Commit:

- `feat(ios): enable background audio session`

## Step 6 - Lock Screen And Remote Controls

Implementation:

- Implement Now Playing metadata updates.
- Include artwork when cover art is available.
- Register play, pause, toggle, next, previous, and seek commands.
- Send remote command events into the TypeScript playback backend.

Tests:

- Vitest for remote command mapping.
- iOS checklist for lock screen, Control Center, headset/Bluetooth controls
  when available.

Commit:

- `feat(ios): add now playing and remote controls`

## Step 7 - Native Cached/Offline Playback

Implementation:

- Implement the iOS native cache adapter.
- Resolve cached songs to native-playable file URIs.
- Keep web Cache API behavior unchanged outside Capacitor iOS.
- Ensure eviction removes native files.
- Ensure offline startup can recover cache metadata.

Tests:

- Vitest resolver tests with mocked native cache adapter.
- Existing cache tests.
- iOS offline playback checklist:
  - Cache a song.
  - Disable network.
  - Restart app.
  - Play cached song.

Commit:

- `feat(ios): support native cached audio playback`

## Step 8 - Error Recovery And Lifecycle

Implementation:

- Map native playback errors to shared error types.
- Implement retry behavior through the shared playback session.
- Handle app pause/resume and source changes without stale events.
- Ensure progress timers stop when playback is disposed.

Tests:

- Vitest for error mapping and stale event generation.
- iOS smoke tests for network loss and source switching.

Commit:

- `fix(ios): harden native playback lifecycle`

## Step 9 - iOS Regression Pass

Implementation:

- Run all relevant TypeScript tests.
- Run web build.
- Run iOS build.
- Execute a manual or automated iOS verification checklist.
- Update notes with any known limitations.

Tests:

- `pnpm run test:unit`
- Targeted Cypress component tests.
- `pnpm run build`
- Capacitor sync for iOS.
- Xcode build/test if available.

Commit:

- `test(ios): verify native playback parity`

## Done Criteria

- iOS native playback is selected only inside Capacitor iOS.
- Web and Electron still use web playback.
- All iOS completion requirements from `00-requirements.md` are satisfied.
- The Android plan remains untouched until this document is complete.
