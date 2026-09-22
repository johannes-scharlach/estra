# Testing

Tests buy confidence and improve design. Test count and branch coverage are not
goals. A test stays only when the failure it catches is important enough to pay
for the code and maintenance it adds.

## Choose The Seam First

Test behavior through the smallest stable public interface that expresses it.
Pure domain functions are preferred when the behavior is wording, parsing,
selection, projection, or another deterministic transformation.

It's often a smell that if behavior is hard to test, the production module has
the wrong boundary. In that case, refactoring the code to add a certain level
of indirection or dependency injection may be beneficial. The goal is to
improve confidence and design, so if a refactor makes the code hard or awkward
to read, avoid it. Sometimes if it's particularly hard to test something, it
may even be a hint at a product issue. In such a case, discuss the intended
behavior with the user before making changes and make suggestions how the
product can change to become more obvious.

For non-trivial test work, state the proposed seam and why it matters before
building a suite. Obvious tests against an existing pure seam do not need a
separate planning round.

## Test What Matters

- Protect product rules, persisted data, destructive actions, concurrency, and
  regressions likely to recur.
- Prefer one representative example and the few boundaries that behave
  differently. Do not enumerate equivalent inputs for completeness.
- Assert observable results, not class names, hook order, private calls, or
  internal state.
- A regression test belongs at a stable seam. If no honest seam exists, fixing
  the bug and documenting device verification can be better than preserving a
  brittle test.
- Test only supported product platforms. Do not add web coverage merely because
  React Native Web can execute the code.

## Test Levels

- Prefer a small number of integration tests at meaningful system boundaries.
  Use unit tests for important pure rules where integration adds no confidence.
- Unit tests cover important deterministic behavior at pure seams.
- Integration tests use real framework behavior across a meaningful boundary.
  Importing a screen while mocking React, routing, storage, and native modules
  is still a unit simulation, not an integration test.
- Native gestures, layout, permissions, keyboards, and pickers need verification
  on a device. Automate them only with a real native harness and when their
  regression cost justifies that harness.

Avoid homemade React runtimes and broad mock graphs. They duplicate framework
semantics, couple tests to implementation, and can pass while the app fails.

## Working Style

Write the smallest useful test yourself. Do not delegate a test when explaining
it costs as much as writing it. Delegation is suitable for research or running
independent verification, not for deciding what behavior deserves tests or
where the seam belongs. At times it may even be useful to delegate fixing a
behavior which is proven broken based on tests.

During implementation, use short red-green steps where the seam is already
clear. Stop when the important behavior is protected. More passing tests are
not evidence of more confidence.

## Commands

- Full static checks: `pnpm typecheck` and `pnpm lint`
- Mobile tests: `pnpm --filter mobile test`
- API unit tests (no database): `pnpm --filter api test`
- Shared rules: `pnpm --filter @estra/meals test`
