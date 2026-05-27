# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aonsoku is a dual-target music streaming client (web + Electron desktop) for Navidrome/Subsonic servers. It supports synchronized lyrics, podcasts, radio streaming, and Discord RPC.

## Commands

```bash
# Development
pnpm run dev              # Web app dev server
pnpm run electron:dev     # Electron desktop dev

# Build
pnpm run build            # Production web build (tsc + vite)
pnpm run electron:build   # Electron renderer/main/preload build
pnpm run make             # Create distributable packages

# Lint & Format (Biome)
pnpm run lint             # Check only
pnpm run lint:fix         # Auto-fix issues
pnpm run lint:format      # Format files

# Tests (Vitest)
pnpm run test:unit
```

## Architecture

### Dual-Target Build

- **Web**: Vite (`vite.config.ts`) builds `src/` as a standard SPA
- **Electron**: `electron.vite.config.ts` builds three separate processes: `electron/main`, `electron/preload`, `electron/renderer` (which re-uses `src/`)
- Platform detection via `src/utils/desktop.ts`

### State Management

Two complementary systems:
- **Zustand** (`src/store/`) — client state with `immer`, `persist`, `subscribeWithSelector` middleware. The player store (`player.store.ts`) is the most complex (~55KB). Persistent data (queue, song lists) goes through `idb.ts` (IndexedDB).
- **TanStack React Query** (`src/queries/`) — server state, caching, and invalidation. Query client configured in `src/lib/queryClient.ts` (refetch-on-window-focus disabled).

### Sync Architecture

Metadata sync runs in a **Web Worker** (`src/service/cache/sync.worker.ts`) to avoid blocking the main thread. Communication with the main thread uses **Comlink**:

- `sync-worker-adapter.ts` creates the Worker, sets up Comlink callbacks, and bridges Zustand/queryClient updates back to the main thread.
- Auth config is injected via `initAuth`/`updateAuth` and automatically synced from `useAppStore`.
- Worker opens its own Dexie instance to the same IndexedDB database.
- If Workers are unavailable, falls back to `metadata-sync.ts` (deprecated, main-thread).

### Data Flow

```
Subsonic/Navidrome server
  → src/api/httpClient.ts (base HTTP)
  → src/service/*.ts (domain API wrappers)
  → src/queries/*.ts (React Query hooks)
  → React components
```

### Routing

React Router v6 with hash routing. Route constants live in `src/routes/routesList.ts`. Auth is enforced via loaders (`protectedLoader.ts`, `loginLoader.ts`) — always use named route constants from `ROUTES` rather than hardcoded strings.

### Component Patterns

- Radix UI primitives + shadcn/ui copy-paste pattern (full ownership of component code)
- `src/app/components/` — reusable UI components
- `src/app/pages/` — route-level page components
- `src/app/tables/` — data table implementations
- Observers (theme, lang, media session) are mounted at the root in `App.tsx`

### Styling

Tailwind CSS with CSS custom properties for layout dimensions (`--header-height`, `--sidebar-width`, `--player-height`). Theme variables (HSL colors for dark/light) are in `src/themes.css`. Dark mode is class-based.

### Code Splitting

Manual chunk strategy defined in `src/manual-chunks.ts` — update this when adding large new dependencies.

## Tooling Notes

- **Package manager**: pnpm only
- **Linter/formatter**: Biome 2.0.6 — double quotes, trailing commas, 80-char line width, no unused vars/imports
- **TypeScript**: strict mode, path alias `@/` → `src/`
- **Git hooks**: Husky is configured (`.husky/`)

## Commit Message Format

`<type>(<scope>): <subject>`

- **type** (required): feat, fix, refactor, test, chore, i18n
- **scope** (optional): A parenthesized area of the codebase, e.g. (queue), (cache), (i18n), (fullscreen), (settings), (header), (user-dropdown)
- **subject**: A concise, lowercase imperative description without a trailing period. For fix commits, it often explains the problem solved; for feat, what was added.

Examples:
- feat(cache): add global AudioCacheQueue with priority scheduling
- fix: robust service worker update detection
- refactor(user-dropdown): reorder menu and remove sync controls
- test: add and improve vitest tests for sync/cache modules
- chore: bump to v0.30.0

The scope is omitted when the change is cross-cutting or doesn't fit a specific area. This follows the Conventional Commits convention.

## Multi-Stack Native Playback

The project implements a unified playback abstraction layer (`PlaybackBackend` interface) supporting multiple platform-native playback stacks:

| Stack | Runtime | Implementation |
|---|---|---|
| Web Audio (HTMLAudioElement) | web, electron | `src/player/playback/web-backend.ts` |
| Native iOS (Capacitor plugin) | capacitor-ios | `src/player/playback/native-backend.ts` |

Key files:

- `src/player/playback/types.ts` — unified PlaybackBackend interface
- `src/player/playback/backend-factory.ts` — platform-aware backend selection
- `src/player/queue-controller/` — queue management (web-controller / native-controller)
- `src/store/player/playback-actions.ts` — runtime-aware action dispatch (iOS branch / Web branch)
- `src/utils/capabilities.ts` — platform detection and capability matrix

### Modification Rules

When modifying playback-related functionality, **all stacks must remain feature-consistent**:

1. Playback logic changes → update both `web-backend.ts` and `native-backend.ts`
2. Queue logic changes → update both `web-controller.ts` and `native-controller.ts`
3. Playback action changes → ensure both iOS and Web branches are covered in `playback-actions.ts`
4. New playback features → define in the `PlaybackBackend` interface and implement in all backends
5. Platform capability differences (`capabilities.ts`) → degrade gracefully when unavailable, never silently ignore
