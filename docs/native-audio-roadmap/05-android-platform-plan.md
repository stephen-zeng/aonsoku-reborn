# Android Platform Plan

## Start Condition

Do not begin this plan until the iOS native implementation is complete and
verified.

Specifically, do not add `@capacitor/android`, do not run `cap add android`,
and do not create Android project files before the iOS done criteria are met.

## Android Target Scope

Android should implement the same TypeScript playback backend contract used by
web and iOS, with Android-native playback and system integration:

- Native playback engine, preferably AndroidX Media3 ExoPlayer.
- MediaSession integration.
- Playback notification controls.
- Audio focus handling.
- Background playback service behavior.
- Cached/offline playback through the shared native cache contract.
- Event parity with iOS and web backends.

## Step 1 - Add Capacitor Android Platform

Implementation:

- Add `@capacitor/android` using the same Capacitor major version already used
  by the project.
- Run Capacitor Android platform creation.
- Keep Android project generation in its own commit.
- Do not change playback behavior yet.

Tests:

- `pnpm run build`
- Capacitor sync for Android.
- Android Gradle build if Android SDK is available.

Commit:

- `feat(android): add capacitor platform`

## Step 2 - Android Plugin Skeleton

Implementation:

- Add Android implementation to the existing native audio plugin.
- Reuse the same TypeScript facade and event names as iOS.
- Add unavailable-safe behavior for missing Android native implementation during
  development.

Tests:

- Vitest facade tests must remain platform-neutral.
- Android Gradle build.

Commit:

- `feat(android): add native audio plugin skeleton`

## Step 3 - Basic Android Playback

Implementation:

- Implement stream playback.
- Support play, pause, stop, seek, progress, duration, ended, and errors.
- Route Capacitor Android playback through the native backend.

Tests:

- Vitest backend tests with mocked Android events.
- Android emulator/device smoke test for song playback.

Commit:

- `feat(android): implement native song playback`

## Step 4 - Media Session And Notification Controls

Implementation:

- Add Android MediaSession.
- Add notification controls for play, pause, next, previous, and seek if
  supported.
- Map Android media commands into the shared backend events.

Tests:

- Android emulator/device checklist:
  - Notification controls.
  - Lock screen controls.
  - Bluetooth/headset controls when available.
- Vitest command mapping tests.

Commit:

- `feat(android): add media session controls`

## Step 5 - Audio Focus And Background Playback

Implementation:

- Handle audio focus gain/loss.
- Pause or duck according to Android best practices.
- Keep playback alive in background according to project requirements.
- Ensure app lifecycle transitions do not desync the TypeScript store.

Tests:

- Android smoke tests for backgrounding, interruption, and focus loss.

Commit:

- `feat(android): handle audio focus and background playback`

## Step 6 - Android Cached/Offline Playback

Implementation:

- Implement Android native cache adapter.
- Resolve cached songs to Android-native playable URIs or cache keys.
- Integrate with eviction and metadata recovery.
- Keep the TypeScript cache contract unchanged.

Tests:

- Existing cache tests.
- Native adapter tests where practical.
- Android offline playback checklist.

Commit:

- `feat(android): support native cached audio playback`

## Step 7 - Android Radio And Error Recovery

Implementation:

- Support radio stream playback.
- Map native errors to shared playback errors.
- Verify retry behavior through the shared playback session.

Tests:

- Android smoke test for radio playback.
- Vitest error mapping tests.

Commit:

- `feat(android): support native radio playback`

## Step 8 - Android Regression Pass

Implementation:

- Run all TypeScript tests.
- Run web build.
- Run Android build.
- Run emulator/device checklist.
- Update docs with Android development and troubleshooting notes.

Tests:

- `pnpm run test:unit`
- Targeted Cypress component tests.
- `pnpm run build`
- Capacitor sync for Android.
- Android Gradle build/test.

Commit:

- `test(android): verify native playback parity`

## Done Criteria

- Android uses native playback only inside Capacitor Android.
- Web, Electron, and iOS behavior remain unchanged.
- Android implements the same backend contract as iOS.
- Cached playback, background playback, media controls, and error recovery are
  verified.
