# Native Audio Roadmap

This directory captures the clarified requirements and step-by-step
implementation plan for modularizing Aonsoku playback, queue control, and cache
code while adding Capacitor-native mobile support.

The work is intentionally split into separate documents so each implementation
step can be executed, tested, and committed independently.

## Documents

- [00-requirements.md](./00-requirements.md): clarified requirements,
  assumptions, non-goals, and definition of done.
- [01-roadmap.md](./01-roadmap.md): phase order and the required sequence of
  implementation steps.
- [02-playback-and-queue-modularization.md](./02-playback-and-queue-modularization.md):
  detailed plan for audio playback and queue control modularization.
- [03-cache-modularization.md](./03-cache-modularization.md): detailed plan for
  cache, offline audio, smart downloads, and storage abstractions.
- [04-ios-native-implementation.md](./04-ios-native-implementation.md):
  complete iOS-first Capacitor native implementation plan.
- [05-android-platform-plan.md](./05-android-platform-plan.md): Android plan
  that must not start until the iOS implementation is complete.
- [06-testing-and-commit-protocol.md](./06-testing-and-commit-protocol.md):
  testing, verification, and git commit rules for every sub-step.

## Execution Rule

Do not treat this roadmap as a single large refactor. Each sub-step must be a
small, reviewable change with its own tests and commit. Android work is blocked
until every iOS requirement in the iOS plan is implemented and verified.
