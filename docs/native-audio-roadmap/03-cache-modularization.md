# Cache Modularization Plan

## Current Pain Points

- `CacheManager` handles orchestration, source URL building, cache reads,
  metadata recovery, cache index mutation, lyrics caching, and eviction-related
  flows.
- `use-cached-audio.ts` returns only a URL string, which is too narrow for
  native playback where the playable source may be a file URL or platform token.
- Cache storage currently assumes web Cache API and blob URL playback.
- Native mobile cache access needs a stable contract before iOS and Android
  implementations diverge.

## Target Shape

Introduce cache boundaries without changing user-facing behavior:

- `src/service/cache/contracts/`
  - Storage, metadata, index, downloader, resolver, and native file contracts.
- `src/service/cache/storage/`
  - Web Cache API adapter.
  - Future iOS native adapter.
  - Future Android native adapter.
- `src/service/cache/audio-source/`
  - Resolve playable audio source descriptors.
- `src/service/cache/download/`
  - Queue, worker adapter, task execution, progress.
- `src/service/cache/smart-download/`
  - Smart download rules and orchestration.
- `src/service/cache/sync/`
  - Metadata sync worker and sync service.

The existing public `src/service/cache/index.ts` export should remain stable
until callers are migrated.

## Audio Source Descriptor

Replace URL-only playback resolution with a typed descriptor:

```ts
type AudioSource =
  | { kind: "stream"; songId: string; url: string }
  | { kind: "blob"; songId: string; url: string; revoke: () => void }
  | { kind: "native-file"; songId: string; uri: string }
  | { kind: "radio"; url: string };
```

The exact type can change during implementation, but it must preserve these
capabilities:

- Web can still play stream URLs and blob URLs.
- Native iOS can receive either stream URLs or local native file URIs.
- Android later can use the same TypeScript shape.
- Callers know when a blob URL must be revoked.

## Step 1 - Add Cache Contracts

Implementation:

- Define interfaces for cache storage, metadata persistence, cache index
  mutation, audio download, and source resolution.
- Add fake implementations for tests.
- Keep current Cache API/Dexie behavior behind default adapters.

Tests:

- Vitest contract tests with fake adapters.

Commit:

- `refactor(cache): add cache service contracts`

## Step 2 - Extract Audio Source Resolution

Implementation:

- Move cached-or-stream decision logic out of React hooks.
- Return `AudioSource` descriptors.
- Keep `useCachedAudioUrl` temporarily as a compatibility hook if needed.
- Add a new hook such as `useAudioSource(songId)` for backend-aware playback.

Tests:

- Cache hit returns blob descriptor on web.
- Cache miss returns stream descriptor.
- Missing cache blob removes stale index entries.
- Index-not-loaded slow path still recovers cached audio.

Commit:

- `refactor(cache): return typed audio sources`

## Step 3 - Isolate Blob URL Lifetime

Implementation:

- Move blob URL creation and revocation into a small web-only adapter.
- Ensure React cleanup does not leak object URLs.
- Ensure source changes revoke old blob URLs exactly once.

Tests:

- Vitest with mocked `URL.createObjectURL` and `URL.revokeObjectURL`.
- Existing audio component tests.

Commit:

- `fix(cache): centralize blob url lifetime`

## Step 4 - Split CacheManager Orchestration

Implementation:

- Keep a thin `cacheManager` facade.
- Move lyrics caching, cover caching, audio caching, detail listing, eviction,
  and sync operations into smaller services.
- Avoid changing behavior in the same commit as file movement unless tests are
  included.

Tests:

- Existing cache tests.
- Add tests for any extracted service with changed logic.

Commit:

- `refactor(cache): split cache manager services`

## Step 5 - Prepare Native Cache Adapter

Implementation:

- Add a native cache adapter interface that can:
  - Store downloaded audio bytes or native file paths.
  - Resolve a song ID to a native-playable URI.
  - Remove files during eviction.
  - Report byte size and metadata.
- Do not add Android implementation here.
- iOS implementation happens in the iOS plan.

Tests:

- Mock native adapter tests.
- Resolver tests confirming native adapter is selected only in Capacitor iOS
  when available.

Commit:

- `refactor(cache): add native cache adapter boundary`

## Step 6 - Smart Download Boundary

Implementation:

- Keep smart download rules independent from concrete storage.
- Let smart downloads enqueue through the download service contract.
- Preserve explicit cache entries over smart or LRU entries.

Tests:

- Existing smart download tests.
- New adapter-level test for explicit entry preservation.

Commit:

- `refactor(cache): decouple smart downloads from storage`

## Done Criteria

- Playback receives typed audio sources instead of raw cache assumptions.
- Cache storage can be backed by web Cache API or native files.
- Cache metadata remains compatible with existing Dexie data.
- Existing cache unit tests pass.
- Native iOS cache implementation can be added without touching React player
  components.
