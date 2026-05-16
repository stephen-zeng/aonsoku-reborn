# Testing And Commit Protocol

## Rule

Every sub-implementation must end with:

1. Focused tests added or updated when behavior is testable.
2. Relevant tests run.
3. A small git commit using the repository commit format.

Do not batch several roadmap steps into one commit.

## Choosing Tests

Use the smallest reliable test set first, then broaden when the change touches
shared behavior.

- Pure logic: `pnpm run test:unit -- <test-file-or-pattern>` when practical.
- Full unit suite: `pnpm run test:unit`.
- React player/component behavior: targeted Cypress component tests, then
  `pnpm run test` for broader confidence when needed.
- TypeScript/build boundaries: `pnpm run build`.
- Electron-sensitive changes: `pnpm run electron:build`.
- iOS native changes: iOS Capacitor sync plus Xcode build/test when available.
- Android native changes later: Android Capacitor sync plus Gradle build/test.

## Component Test Guidance

Add or update Cypress component tests when a step changes:

- Player controls.
- Audio element or backend event wiring.
- Progress, duration, buffering, seeking, retry, or end handling.
- Queue UI state.
- Volume controls and platform capability behavior.
- Cached/offline playback source selection visible to React.

Do not add component tests for pure queue/cache functions when Vitest covers the
behavior more directly.

## Native Test Guidance

Native behavior may not always be fully automatable in the current repository.
For native steps:

- Add TypeScript contract tests with mocked plugin events.
- Run native build commands when the local toolchain is available.
- Maintain a short manual simulator/device checklist in the implementation
  notes for behavior that cannot be automated yet.
- If a native command cannot run because Xcode, Android SDK, a simulator, or a
  signing setup is unavailable, record that before committing.

## Commit Format

Use:

```text
<type>(<scope>): <subject>
```

Allowed types for this work:

- `feat`
- `fix`
- `refactor`
- `test`
- `chore`

Recommended scopes:

- `player`
- `queue`
- `cache`
- `platform`
- `capacitor`
- `ios`
- `android`
- `player-store`

Examples:

```text
refactor(queue): extract pure queue transitions
test(player): cover native playback event mapping
feat(ios): add now playing and remote controls
feat(android): add capacitor platform
fix(cache): centralize blob url lifetime
```

## Per-Step Checklist

Before implementation:

- Read the relevant roadmap document.
- Confirm whether the step changes behavior or only moves code.
- Identify the narrowest tests that protect the behavior.
- Check `git status --short` and preserve unrelated user changes.

During implementation:

- Keep public imports stable unless the step explicitly changes them.
- Avoid changing persisted state shape without a migration and migration tests.
- Keep platform-specific code behind adapters.
- Keep Android untouched until iOS is complete.

Before commit:

- Run focused tests.
- Run broader tests if the step touches shared behavior.
- Run formatting/linting if code style changed.
- Check `git diff`.
- Commit only the files that belong to the completed sub-step.

After commit:

- Note any skipped tests and the reason.
- Move to the next sub-step only after the current step is committed.

## Suggested Verification Matrix

| Change Area | Minimum Verification |
| --- | --- |
| Queue pure logic | Vitest queue tests |
| Player backend contract | Vitest fake backend tests |
| React player UI | Cypress component tests |
| Cache resolver/storage | Vitest cache tests |
| Web playback | Cypress player/audio tests |
| Electron playback-sensitive code | `pnpm run electron:build` |
| iOS native bridge | Vitest mocked plugin tests and iOS build |
| iOS system behavior | Simulator/device checklist |
| Android platform | Gradle build/test after Android phase starts |

## Stop Conditions

Pause before committing if:

- A test fails for an unclear reason.
- A persisted data migration is needed but not covered.
- A native platform change requires credentials or local tooling that is
  unavailable.
- A change would add Android files before iOS completion.
- Unrelated user changes overlap with the files being edited and the safe path
  is unclear.
