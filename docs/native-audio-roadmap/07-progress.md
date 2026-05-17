# Progress

This document tracks the completed work for the native audio roadmap. Update it
after every completed sub-step, including verification results and the git
commit that contains the change.

## Current Status

- Roadmap status: Phase 4 complete.
- Active implementation phase: Phase 5 - Android Platform Support.
- Next step: Phase 5 Step 1, add Capacitor Android platform support.
- Android status: unblocked by Phase 4 completion; not started.

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
| 2026-05-17 | Phase 3.2 - Route Capacitor iOS to native backend | Added `NativeAudioPlaybackBackend` around the typed facade, native event mapping into the shared playback backend contract, and a backend factory that selects native playback only for Capacitor iOS when `AonsokuNativeAudio` is available. `AudioPlayer` now uses the factory, bridges native backend progress/play/pause/end/error events into existing player state, keeps web/Electron on `WebAudioPlaybackBackend`, and falls back to web when the native plugin is missing or construction fails. No Android dependency or project file was added. | `pnpm exec vitest run src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts src/player/playback/playback-backend.test.ts` 16/16 passed. `pnpm run test:unit` 726/726 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. Commit hook Biome lint passed. Cypress not run because the local Cypress host issue remains out of scope. | `7b9e9f81 feat(ios): select native audio backend in Capacitor` |
| 2026-05-17 | Phase 4.1 - Add native iOS plugin skeleton | Created the local `@aonsoku/native-audio` Capacitor plugin under `capacitor-plugins/aonsoku-native-audio`, added TypeScript definitions/registration helpers with unavailable-safe web behavior, added the iOS Swift `CAPBridgedPlugin` skeleton for the full native audio method surface, and wired the existing iOS SPM app package to include it. No Android dependency or project file was added. | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts` 11/11 passed. `pnpm exec cap sync ios` succeeded and found `@capacitor/keyboard` plus `@aonsoku/native-audio`. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded after rerun with network/cache approval for Swift package resolution. `pnpm run test:unit` 731/731 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. Commit hook Biome lint passed. | `b72bca5a feat(ios): add native audio plugin skeleton` |
| 2026-05-17 | Phase 4.2 - Basic native playback | Implemented iOS `load`, `play`, `pause`, `stop`, `seek`, and `clear` using `AVPlayer`/`AVPlayerItem` for stream and radio URLs. Added native KVO/notification/time observers for playback state, duration, buffering, progress, ended, and error events. Unsupported future source types still reject clearly; future queue/metadata/preload controls currently resolve as no-ops until their roadmap steps. No Android dependency or project file was added. | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts` 21/21 passed. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded after rerun with Xcode cache approval. `pnpm run lint` passed. `pnpm run test:unit` 732/732 passed. `pnpm run build` succeeded with existing Vite warnings. Commit hook Biome lint passed. | `54066c78 feat(ios): implement native song playback` |
| 2026-05-17 | Phase 4.3 - Queue and end handling | Extended the shared playback backend contract with repeat, shuffle, and skip control hooks. `AudioPlayer` now registers the active backend, syncs loop/shuffle state to native playback, routes seek-to-start and seek requests through the backend registry, and bases ended decisions on the shared queue transition helper. The iOS plugin now stores repeat/shuffle/queue control state and emits remote command events for native skip requests without making native queue state authoritative. No Android dependency or project file was added. | `pnpm exec vitest run src/player/playback/playback-backend.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts src/store/player/queue-transitions.test.ts` 92/92 passed. `pnpm run lint` passed. `pnpm run test:unit` 735/735 passed. `pnpm run build` succeeded with existing Vite warnings. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded after rerun with Xcode cache approval. Manual iOS smoke checklist for next, previous, repeat-one, and repeat-all was not run in this non-interactive session. Commit hook Biome lint passed. | `22342546 feat(ios): connect native playback to queue controls` |
| 2026-05-17 | Phase 4.4 - Radio playback | Passed typed radio source descriptors (including radio IDs) into the native backend, routed native radio error events through the existing `PlaybackSession` retry path, reset retry state on native play events, and updated the iOS plugin to track current radio/source state and reset native control state on clear. No Android dependency or project file was added. | `pnpm exec vitest run src/service/cache/audio-source/index.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts` 36/36 passed. `pnpm run lint` passed. `pnpm run test:unit` 739/739 passed. `pnpm run build` succeeded with existing Vite warnings. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded after rerun with Xcode cache approval. Manual iOS radio smoke checklist for play, pause, and error recovery was not run in this non-interactive session. Commit hook Biome lint passed. | `347ced1f feat(ios): support native radio playback` |
| 2026-05-17 | Phase 4.5 - Background audio and audio session | Enabled iOS background audio mode, configured the native plugin's `AVAudioSession` for playback, activated the session on native play/autoplay, handled audio interruptions with optional resume, emitted route-change and interruption bridge events, and resynced playback state/progress on background and foreground transitions. No Android dependency or project file was added. | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts` 24/24 passed. `pnpm run lint` passed. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded. `pnpm run test:unit` 740/740 passed. `pnpm run build` succeeded with existing Vite warnings. Manual iOS checklist for background, lock screen, interruption resume, and route switching was not run in this non-interactive session. Commit hook Biome lint passed. | `94724936 feat(ios): enable background audio session` |
| 2026-05-17 | Phase 4.6 - Lock screen and remote controls | Extended the shared playback backend with metadata and remote-command events, passed song/radio metadata and artwork URLs into native playback, mapped iOS remote commands back through TypeScript player actions, and implemented `MPNowPlayingInfoCenter` plus `MPRemoteCommandCenter` support in the iOS plugin. No Android dependency or project file was added. | `pnpm exec vitest run src/player/playback/remote-command.test.ts src/player/playback/native-backend.test.ts src/player/playback/playback-backend.test.ts src/native/audio/plugin-skeleton.test.ts` 26/26 passed. `pnpm run lint` passed. `pnpm run test:unit` 744/744 passed. `pnpm run build` succeeded with existing Vite warnings. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded. Manual iOS checklist for lock screen metadata/artwork, Control Center transport/seek, and headset/Bluetooth controls was not run in this non-interactive session. Commit hook Biome lint passed. | `6e1e7a16 feat(ios): add now playing and remote controls` |
| 2026-05-17 | Phase 4.7 - Native cached/offline playback | Implemented the Capacitor iOS native cache bridge, storing downloaded audio files in Application Support with sidecar metadata and resolving them as native-playable file URIs. Capacitor iOS cache downloads now use the main-thread downloader so the native plugin can persist files, source resolution recovers/touches native cache metadata on startup, and cache eviction/clear paths remove native audio files. Web/Electron Cache API behavior remains unchanged; Android remains untouched. | `pnpm exec vitest run src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts` 73/73 passed. `pnpm run test:unit` 757/757 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. `pnpm exec cap sync ios` succeeded. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded after fixing the Swift backup-exclusion API call. Manual iOS offline playback checklist was not run in this non-interactive session. Commit hook Biome lint passed. | `5a29970d feat(ios): support native cached audio playback` |
| 2026-05-17 | Phase 4.8 - Error recovery and lifecycle hardening | Added shared playback error classification for native iOS failures, mapped native plugin errors to the same retry categories as web audio, routed retryable native song/radio failures through `PlaybackSession`, and added request-scoped native events so source changes, app lifecycle resyncs, and delayed AVPlayer callbacks cannot update the active player from stale loads. The iOS plugin now guards KVO/notification/progress callbacks by playback generation and still removes the periodic time observer during clear/dispose. No Android dependency or project file was added. | `pnpm exec vitest run src/player/playback/errors.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts` 36/36 passed. `pnpm run lint` passed. `pnpm run test:unit` 762/762 passed. `pnpm run build` succeeded with existing Vite warnings. `pnpm exec cap sync ios` succeeded. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded. Manual iOS smoke tests for network loss and source switching were not run in this non-interactive session. Commit hook Biome lint passed. | `5db40485 fix(ios): harden native playback lifecycle` |
| 2026-05-17 | Phase 4.9 - iOS regression pass | Added a parity regression test that keeps the app native facade, local plugin package definitions, and Swift bridge aligned for native audio methods, events, and source kinds. Ran the Phase 4 TypeScript regression slice, full unit suite, lint, web build, Capacitor iOS sync, Xcode iOS build, and Android absence guard. No Android files or dependencies were added. | `pnpm exec vitest run src/native/audio/plugin-skeleton.test.ts src/native/audio/facade.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts src/player/playback/remote-command.test.ts src/player/playback/errors.test.ts src/player/playback/session.test.ts src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts` 101/101 passed. `pnpm run test:unit` 763/763 passed. `pnpm run lint` passed. `pnpm run build` succeeded with existing Vite warnings. Cypress was skipped by user instruction because the local Cypress install is broken. `pnpm exec cap sync ios` succeeded. `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` succeeded. `xcodebuild -list -project ios/App/App.xcodeproj` showed no test targets beyond app/plugin schemes. Manual iOS parity checks were not run in this non-interactive session. | `3c227e9c test(ios): verify native playback parity` |

## Phase Checklist

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Baseline And Guardrails | Complete | Both Phase 0.1 and 0.2 done. Follow-up review corrected browser/PWA vs native Capacitor runtime detection. |
| Phase 1 - Playback And Queue Modularization | Complete | Phase 1.1 through 1.4 are complete. Cypress was not run in this session because the local Cypress installation has a known host issue and the user requested not to run or repair it. |
| Phase 2 - Cache Modularization | Complete for Phase 3 handoff | Phase 2.1 through 2.3 are complete per `01-roadmap.md`. Detailed cache follow-ups in `03-cache-modularization.md` remain useful future hardening work. |
| Phase 3 - Capacitor Bridge Foundation | Complete | Phase 3.1 and 3.2 are complete. Native playback is selected only for Capacitor iOS when the facade reports the plugin is available; otherwise web playback remains the fallback. |
| Phase 4 - Complete iOS Native Implementation | Complete | Steps 1 through 9 are complete. Automated regression/build checks passed; manual simulator/device parity checks remain documented as not run in this non-interactive session. |
| Phase 5 - Android Platform Support | Not started | Phase 4 completion unblocks Android work, but `@capacitor/android` and Android project files have not been added yet. |
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
| 2026-05-17 | `pnpm exec vitest run src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts src/player/playback/playback-backend.test.ts` | 16 passed | Phase 3.2 native backend wrapper, backend selection/fallback, and existing web backend contract coverage. |
| 2026-05-17 | `pnpm run test:unit` | 726 passed | Full unit suite after Phase 3.2. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 3.2; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts` | 11 passed | Phase 4.1 facade and plugin skeleton packaging tests. |
| 2026-05-17 | `pnpm exec cap sync ios` | Succeeded | Generated `ios/App/CapApp-SPM/Package.swift` includes `@aonsoku/native-audio`; Capacitor found 2 iOS plugins. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | First sandboxed run could not resolve `github.com`; rerun with approval resolved `capacitor-swift-pm` and compiled the iOS app/plugin. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.1; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 731 passed | Full unit suite after Phase 4.1. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts` | 21 passed | Phase 4.2 native playback implementation surface and existing native backend/factory tests. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | First sandboxed run could not write Xcode/SwiftPM caches; rerun with approval compiled the updated `AVPlayer` plugin. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.2; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 732 passed | Full unit suite after Phase 4.2. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec vitest run src/player/playback/playback-backend.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts src/store/player/queue-transitions.test.ts` | 92 passed | Phase 4.3 backend contract, native backend controls, ended decisions, plugin control surface, and unchanged queue transition coverage. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.3; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 735 passed | Full unit suite after Phase 4.3. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | First sandboxed run could not write SwiftPM/Xcode cache files; rerun with approval compiled the updated native queue-control plugin. |
| 2026-05-17 | iOS simulator/device smoke checklist | Not run | Manual next, previous, repeat-one, and repeat-all smoke checks need an interactive simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/service/cache/audio-source/index.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts` | 36 passed | Phase 4.4 source selection, native radio load mapping, native-placeholder retry behavior, and Swift radio/clear-state bridge checks. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.4; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 739 passed | Full unit suite after Phase 4.4. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | First sandboxed run could not write SwiftPM/Xcode cache files; rerun with approval compiled the updated native radio plugin. |
| 2026-05-17 | iOS simulator/device radio smoke checklist | Not run | Manual radio play, pause, and error recovery checks need an interactive simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/plugin-skeleton.test.ts` | 8 passed | Phase 4.5 focused coverage for background audio mode and native audio-session lifecycle handling. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts` | 24 passed | Phase 4.5 native facade, Swift bridge surface, native backend, and backend selection coverage. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.5; commit hook also ran Biome and passed. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | Compiled the updated `AVAudioSession`, interruption, route-change, and iOS background-audio plugin changes. |
| 2026-05-17 | `pnpm run test:unit` | 740 passed | Full unit suite after Phase 4.5. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | iOS simulator/device background audio checklist | Not run | Manual background playback, lock screen playback, interruption resume, and route-switching checks need an interactive simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/player/playback/remote-command.test.ts src/player/playback/native-backend.test.ts src/player/playback/playback-backend.test.ts src/native/audio/plugin-skeleton.test.ts` | 26 passed | Phase 4.6 remote command mapping, native metadata bridge, backend contract, and Swift Now Playing/remote-command surface coverage. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.6; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 744 passed | Full unit suite after Phase 4.6. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | Compiled the updated `MPNowPlayingInfoCenter`, artwork loading, remote-command center, and TypeScript metadata bridge changes. |
| 2026-05-17 | iOS simulator/device lock screen and remote control checklist | Not run | Manual lock screen metadata/artwork, Control Center play/pause/seek/next/previous, and headset/Bluetooth controls need an interactive simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts src/native/audio/facade.test.ts src/native/audio/plugin-skeleton.test.ts src/player/playback/native-backend.test.ts` | 73 passed | Phase 4.7 native cache adapter, native-file source recovery, native eviction hooks, facade/plugin surface, and native backend source mapping coverage. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/plugin-skeleton.test.ts` | 10 passed | Reran after fixing the Swift backup-exclusion API call. |
| 2026-05-17 | `pnpm run test:unit` | 757 passed | Full unit suite after Phase 4.7. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.7; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec cap sync ios` | Succeeded | Capacitor found `@aonsoku/native-audio` and `@capacitor/keyboard` and rewrote the generated iOS SPM package. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | First run caught an invalid `URL.setResourceValue` call; rerun after switching to `URLResourceValues` compiled the native cache bridge. |
| 2026-05-17 | iOS simulator/device offline playback checklist | Not run | Manual cache song, disable network, restart app, and play cached song checks need an interactive iOS simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/player/playback/errors.test.ts src/player/playback/native-backend.test.ts src/player/playback/session.test.ts src/native/audio/plugin-skeleton.test.ts` | 36 passed | Phase 4.8 shared error mapping, native retry/stale-event filtering, existing session retry behavior, and Swift lifecycle guard coverage. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.8; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run test:unit` | 762 passed | Full unit suite after Phase 4.8. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | `pnpm exec cap sync ios` | Succeeded | Capacitor found `@aonsoku/native-audio` and `@capacitor/keyboard` and rewrote the generated iOS SPM package. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | Compiled the updated native error mapping, request-scoped event payloads, playback-generation guards, and time-observer cleanup path. |
| 2026-05-17 | iOS simulator/device error recovery checklist | Not run | Manual network-loss retry and rapid source-switching smoke checks need an interactive iOS simulator/device session. |
| 2026-05-17 | `pnpm exec vitest run src/native/audio/plugin-skeleton.test.ts src/native/audio/facade.test.ts src/player/playback/native-backend.test.ts src/player/playback/backend-factory.test.ts src/player/playback/remote-command.test.ts src/player/playback/errors.test.ts src/player/playback/session.test.ts src/service/cache/native-cache-adapter.test.ts src/service/cache/audio-source/index.test.ts src/service/cache/cache-manager.test.ts` | 101 passed | Phase 4.9 native playback parity regression slice, including facade/plugin/Swift contract parity, backend selection, native event/error mapping, remote commands, session retry, native cache adapter, source resolver, and cache manager eviction coverage. |
| 2026-05-17 | `pnpm run test:unit` | 763 passed | Full unit suite after adding the native contract parity regression. |
| 2026-05-17 | `pnpm run lint` | Passed | Biome lint after Phase 4.9; commit hook also ran Biome and passed. |
| 2026-05-17 | `pnpm run build` | Succeeded | Build succeeds; existing Vite chunking and non-module `env-config.js` warnings remain. |
| 2026-05-17 | Cypress component regression | Skipped by user instruction | The user requested not to run Cypress for this task because the local Cypress install is broken. Earlier smoke-test launches failed with SIGKILL before any spec ran. |
| 2026-05-17 | `pnpm exec cap sync ios` | Succeeded | Capacitor found `@aonsoku/native-audio` and `@capacitor/keyboard`, copied web assets, and rewrote the generated iOS SPM package without leaving tracked files dirty. |
| 2026-05-17 | `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination generic/platform=iOS -derivedDataPath /private/tmp/aonsoku-ios-derived-data CODE_SIGNING_ALLOWED=NO build` | Succeeded | Compiled the iOS app and `AonsokuNativeAudio` plugin for a generic unsigned iOS build. |
| 2026-05-17 | `xcodebuild -list -project ios/App/App.xcodeproj` | Succeeded | Listed app/plugin schemes and only the `App` target; no Xcode test target is configured for this iOS project. |
| 2026-05-17 | Android absence guard | Passed | `test ! -d android` passed. `rg` found `@capacitor/android` only in roadmap documentation, not in app manifests or lockfiles. |
| 2026-05-17 | iOS simulator/device parity checklist | Not run | Manual song, radio, queue, remote-control, background, interruption, offline, network-loss, and rapid source-switching checks need an interactive iOS simulator/device session. |

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

### Phase 4.1 - Native Audio Plugin Skeleton

**`capacitor-plugins/aonsoku-native-audio/`** - New local Capacitor plugin:
- `package.json`: declares `@aonsoku/native-audio` as an iOS-only Capacitor
  plugin with `@capacitor/core` as a peer dependency and no Android manifest.
- `src/definitions.ts`: defines the native audio source, metadata,
  queue/control, and event contracts for the plugin package.
- `src/index.ts` and `src/web.ts`: register `AonsokuNativeAudio` and provide
  unavailable-safe web behavior for non-iOS runtimes.
- `Package.swift`: declares the Swift package product
  `AonsokuNativeAudio`.
- `ios/Sources/AonsokuNativeAudioPlugin/AonsokuNativeAudioPlugin.swift`:
  exposes the full Step 1 bridged method list as a `CAPBridgedPlugin`. Methods
  reject with `not_implemented` until Phase 4 Step 2 implements playback.

**iOS app wiring**:
- Root `package.json` now depends on
  `@aonsoku/native-audio` via
  `file:capacitor-plugins/aonsoku-native-audio`.
- `pnpm-lock.yaml` includes the local file dependency.
- `ios/App/CapApp-SPM/Package.swift` includes
  `AonsokuNativeAudio` after `pnpm exec cap sync ios`.

**`src/native/audio/plugin-skeleton.test.ts`** (5 tests):
- Verifies the local package is iOS-only and has no Android manifest.
- Verifies the app includes the local file dependency.
- Verifies the plugin `Package.swift` package/product/target surface.
- Verifies the Swift bridge uses the `AonsokuNativeAudio` JS name and exposes
  every expected native audio method.
- Verifies the generated iOS SPM package includes the plugin dependency and
  product.

### Phase 4.2 - Basic Native Playback

**`AonsokuNativeAudioPlugin.swift`**:
- Uses `AVPlayer` and `AVPlayerItem` for native stream/radio URL playback.
- Implements `load`, `play`, `pause`, `stop`, `seek`, and `clear`.
- Emits shared plugin events: `playbackStateChanged`, `progress`,
  `durationChanged`, `bufferingChanged`, `ended`, and `error`.
- Cleans up KVO, notification, and periodic time observers on clear/deinit.
- Rejects blob/native-file sources until cached playback work lands.
- Leaves queue, shuffle, repeat, metadata, preload, next, and previous as
  successful no-ops until their dedicated Phase 4 steps.

**`src/native/audio/plugin-skeleton.test.ts`**:
- Expanded to assert the Swift plugin imports AVFoundation, owns an `AVPlayer`,
  no longer contains `not_implemented`, and emits the shared playback event
  names.

### Phase 4.3 - Queue And End Handling

**Shared playback contract and React host**:
- Extended `PlaybackBackend` with repeat-mode, shuffle, next, and previous
  control hooks while keeping queue transitions in TypeScript.
- Added `src/player/playback/backend-registry.ts` so non-DOM seek requests can
  target the active backend. Previous-button seek-to-start, slider seeking, and
  LAN seek commands now use this registry and fall back to `audio.currentTime`
  when no backend is registered.
- `AudioPlayer` registers and unregisters the active backend, syncs loop and
  shuffle state through the backend, and keeps native ended handling aligned
  with `transitionHandleSongEnded`.
- `PlaybackSession` ended decisions now derive from the shared queue
  transition helper instead of duplicating queue-state checks.

**iOS native plugin**:
- `setRepeatMode`, `setShuffle`, and `setQueue` now validate/store native
  control state for iOS system integration work.
- `skipToNext` and `skipToPrevious` emit `remoteCommand` events instead of
  advancing native playback independently. TypeScript remains the authoritative
  queue owner; native currently receives the active item through `load`, not an
  authoritative full queue.

**Tests updated**:
- `src/player/playback/playback-backend.test.ts`: covers the expanded backend
  control contract, repeat-mode mapping, and backend registry seeking.
- `src/player/playback/native-backend.test.ts`: verifies native control
  delegation for repeat, shuffle, next, and previous.
- `src/player/playback/session.test.ts`: verifies ended decisions through the
  shared queue transition path.
- `src/native/audio/plugin-skeleton.test.ts`: verifies native control state and
  `remoteCommand` emission.
- `src/store/player/queue-transitions.test.ts` continued to pass unchanged.

### Phase 4.4 - Radio Playback

**Shared playback and source resolution**:
- `Player` now creates typed radio descriptors with
  `audioSourceResolver.resolveRadioSource()`, so Capacitor iOS receives
  native `radio` sources with radio IDs instead of generic stream fallbacks.
- `AudioPlayer` routes native backend error events through the existing
  `PlaybackSession` retry path while in radio mode, preserving web radio retry
  behavior for native iOS playback.
- Native play events now call `PlaybackSession.handlePlayEvent()` so successful
  native radio playback clears retry/source-change state like DOM playback.

**iOS native plugin**:
- The Swift plugin resolves stream and radio sources separately, stores the
  current source kind/radio ID for native state tracking, and clears that state
  when playback is cleared.
- `clear` now resets native repeat/shuffle/queue control state after tearing
  down the current player item.

**Tests updated**:
- `src/service/cache/audio-source/index.test.ts`: verifies radio source
  descriptors do not touch song cache state.
- `src/player/playback/native-backend.test.ts`: verifies radio sources are
  passed to the native plugin with radio metadata.
- `src/player/playback/session.test.ts`: verifies retry works for native
  placeholder audio elements that have no DOM `src`.
- `src/native/audio/plugin-skeleton.test.ts`: verifies Swift radio source
  handling and clear-state reset behavior.

### Phase 4.5 - Background Audio And Audio Session

**iOS app configuration**:
- `ios/App/App/Info.plist` now declares `UIBackgroundModes` with `audio`, so
  the Capacitor iOS app can continue audio playback while backgrounded.

**iOS native plugin**:
- `AonsokuNativeAudioPlugin.swift` configures `AVAudioSession` with the
  `.playback` category and activates the session when native playback starts.
- Native `stop` and `clear` deactivate the audio session with
  `.notifyOthersOnDeactivation`.
- The plugin observes `AVAudioSession.interruptionNotification` and emits
  `interruptionChanged` events. It pauses on interruption start and resumes
  only when iOS indicates playback should resume and the player had been
  playing before the interruption.
- The plugin observes `AVAudioSession.routeChangeNotification`, emits
  `routeChanged` events with mapped route-change reasons, and resyncs
  playback state/progress.
- The plugin observes foreground/background app lifecycle notifications and
  emits current playback state/progress so TypeScript can catch up after app
  visibility changes.

**Tests updated**:
- `src/native/audio/plugin-skeleton.test.ts`: verifies iOS background audio
  mode, `AVAudioSession` playback-category setup, lifecycle observers, and
  native interruption/route-change event emission.

### Phase 4.6 - Lock Screen And Remote Controls

**Shared playback contract and React host**:
- Added `PlaybackMetadata` to the backend contract and passed song/radio
  metadata from `Player` into `AudioPlayer`, including song artwork URLs from
  the existing cover-art preference resolver.
- Added a typed `remoteCommand` backend event plus
  `handlePlaybackRemoteCommand()` so play, pause, toggle, next, previous, and
  seek commands flow back through TypeScript player actions while TypeScript
  remains authoritative for queue state.
- `NativeAudioPlaybackBackend` now forwards metadata to `load`/
  `updateMetadata` and maps native `remoteCommand` events into the shared
  backend event surface. The web backend accepts metadata as a no-op.

**iOS native plugin**:
- Imports `MediaPlayer`, registers `MPRemoteCommandCenter` handlers for play,
  pause, toggle play/pause, next, previous, and change playback position, and
  emits shared `remoteCommand` bridge events for each command.
- Updates `MPNowPlayingInfoCenter` with title, artist, album, duration, elapsed
  time, playback rate, and default playback rate.
- Fetches metadata artwork URLs asynchronously, applies stale-update guards,
  and installs `MPMediaItemArtwork` when an image is available.
- Clears Now Playing metadata and cancels pending artwork work when native
  playback is cleared.

**Tests updated**:
- `src/player/playback/remote-command.test.ts`: covers the shared remote
  command mapping into player actions.
- `src/player/playback/native-backend.test.ts`: verifies metadata forwarding
  and native remote-command event mapping.
- `src/player/playback/playback-backend.test.ts`: covers the expanded backend
  contract with metadata updates.
- `src/native/audio/plugin-skeleton.test.ts`: verifies the Swift Now Playing,
  artwork, and remote-command center integration surface.

### Phase 4.7 - Native Cached/Offline Playback

**Native cache bridge**:
- Extended the `AonsokuNativeAudio` plugin surface with `storeAudioFile`,
  `resolveAudioFile`, `getAudioFileSize`, `deleteAudioFile`, and
  `clearAudioFiles`.
- The iOS plugin stores downloaded audio under Application Support
  `Aonsoku/AudioCache`, writes sidecar metadata, excludes the directory from
  device backup, resolves deterministic `file://` URIs, and accepts
  `native-file` sources in `AVPlayer`.
- `IosNativeCacheAdapter` converts downloaded blobs to base64 for the
  Capacitor bridge and normalizes native file/size/delete/clear responses.

**Cache integration**:
- Capacitor iOS uses the main-thread cache downloader so the native plugin can
  persist audio files during downloads. Web/Electron retain the existing worker
  and Cache API path.
- `CacheAudioSourceResolver` prefers native files, touches or restores cache
  metadata when native files are found during startup, and writes synthetic
  metadata if the file exists but no saved row is available.
- `CacheManager` now removes native audio files on single-item eviction,
  source-based audio clears, and full cache clears.

**Tests updated**:
- `src/service/cache/native-cache-adapter.test.ts`: covers iOS adapter
  selection, base64 storage, resolve/size/delete/clear calls, and no-op helper
  behavior outside Capacitor iOS.
- `src/service/cache/audio-source/index.test.ts`: covers native-file
  preference and metadata recovery/synthesis from native files.
- `src/service/cache/cache-manager.test.ts`: covers native file deletion during
  eviction, source clears, and full cache clears.
- `src/native/audio/plugin-skeleton.test.ts`: verifies the Swift native cache
  bridge and `native-file` playback surface.

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
  `NativeFileResolver` with `storeAudioFile`, `getAudioFileSize`,
  `evictAudioFile`, and `clearAudioFiles`. `native-cache-adapter.ts` provides a
  platform-aware factory (`getNativeCacheAdapter()`) that returns a null
  adapter on web/Electron, an iOS adapter when `AonsokuNativeAudio` is available
  in Capacitor iOS, and keeps Android unavailable until Phase 5. The
  `CacheAudioSourceResolver` uses this factory as its default
  `nativeFileResolver`. `FakeNativeCacheAdapter` is available for tests.
- Phase 3.1 is complete. The TypeScript Capacitor native audio facade lives in
  `src/native/audio/`. It registers `AonsokuNativeAudio`, defines typed source,
  metadata, queue/control, and event contracts, provides unavailable-safe web
  behavior, and exposes availability/listener helpers for mocked and future
  native backends.
- Phase 3.2 is complete. `src/player/playback/native-backend.ts` adapts the
  native facade to the shared `PlaybackBackend` contract, and
  `src/player/playback/backend-factory.ts` selects it only for Capacitor iOS
  when `AonsokuNativeAudio` is available. `AudioPlayer` uses the factory,
  bridges native backend events into the existing store state, omits the DOM
  audio `src` while native playback is active, and falls back to web playback
  when the native plugin is unavailable.
- Phase 4.1 is complete. The local iOS plugin skeleton lives in
  `capacitor-plugins/aonsoku-native-audio/`, is wired into the app through a
  local file dependency, and is included in the generated iOS SPM package.
  The Swift methods intentionally reject with `not_implemented` until Phase 4
  Step 2 implements basic native playback.
- Phase 4.2 is complete. The iOS plugin now uses `AVPlayer` for remote
  stream/radio sources and emits the shared playback/progress/duration/
  buffering/ended/error events. Now Playing metadata, native cached playback,
  and lifecycle hardening were handled in later Phase 4 steps.
- Phase 4.3 is complete. Native ended decisions now flow through the shared
  TypeScript queue transition helper, loop/shuffle control state is synchronized
  through the playback backend, and seek-to-start/user seek paths use the active
  backend so Capacitor iOS reaches `AVPlayer` instead of only mutating the
  placeholder DOM audio element. Native skip commands emit command events for
  TypeScript to handle; native queue state is not authoritative.
- Phase 4.4 is complete. Native radio playback now receives explicit radio
  source descriptors, native radio errors retry through the shared playback
  session, and clearing radio playback tears down the native player/source
  state. Manual radio play, pause, and error-recovery checks still need an
  interactive iOS simulator/device session.
- Phase 4.5 is complete. The iOS app declares background audio mode, and the
  native plugin configures/activates `AVAudioSession` for playback, handles
  interruptions and route changes, and resyncs playback state/progress across
  background and foreground transitions. Manual background playback, lock
  screen playback, interruption-resume, and route-switching checks still need
  an interactive iOS simulator/device session.
- Phase 4.6 is complete. Native iOS playback now receives song/radio metadata,
  publishes lock screen and Control Center Now Playing information with
  artwork when available, and sends native remote controls back through the
  shared TypeScript backend event surface. Manual lock screen, Control Center,
  and headset/Bluetooth checks still need an interactive iOS simulator/device
  session.
- Phase 4.7 is complete. The native cache bridge now stores downloaded audio
  files through `AonsokuNativeAudio.storeAudioFile`, resolves cached songs to
  `native-file` descriptors for `AVPlayer`, recovers cache metadata from native
  file records when the startup index is empty, and removes native files during
  eviction/source clears/full cache clears. Capacitor iOS uses the main-thread
  download engine for cache writes; web/Electron behavior remains on the Cache
  API and Android remains untouched. Manual offline playback checks still need
  an interactive iOS simulator/device session.
- Phase 4.8 is complete. Native iOS errors now normalize to shared playback
  error kinds/media codes, retryable native song and radio failures go through
  the shared `PlaybackSession`, and native events carry request IDs so delayed
  AVPlayer callbacks from older loads are ignored by the TypeScript backend.
  The Swift plugin also guards KVO/notification/progress callbacks with a
  playback generation and removes the periodic time observer during player
  clear/dispose. Manual network-loss and rapid source-switching checks still
  need an interactive iOS simulator/device session.
- Phase 4.9 is complete. The iOS regression pass added a parity test covering
  the app facade, plugin package definitions, and Swift bridge method/event/
  source contract. Focused native playback/cache tests, the full Vitest suite,
  lint, web build, Capacitor iOS sync, and unsigned generic iOS Xcode build all
  passed. The Xcode project does not currently define a test target. Manual iOS
  parity checks still need an interactive simulator/device session.
- Public imports from `@/store/player.store` remain stable.
- Public imports of `buildAudioUrl` from `@/service/cache` remain stable.
- Cypress component tests were skipped for Phase 4.9 by user instruction
  because this machine has a known broken Cypress install, and Cypress repair
  is out of scope for this roadmap work.
- The next implementation session should begin Phase 5 Step 1 from
  `05-android-platform-plan.md`: add Capacitor Android platform support.
- Keep every sub-step small, tested, and committed independently.
- Phase 4 completion unblocks Android work, but Android remains not started:
  no `@capacitor/android` dependency or Android project files have been added.
