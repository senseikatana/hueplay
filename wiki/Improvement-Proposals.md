# Improvement Proposals

This page records concrete, evidence-based proposals for improving Color
Compass. The linked GitHub issues are the implementation backlog; this page is
an overview, not a second issue tracker.

These proposals originated in the pre-Astro review. The current code now has
Worker tests in `tests/worker.test.ts`, a stricter parser, keyboard dial
controls, and accessible copy feedback. Reconcile each issue with the current
implementation before starting work; the original observations below are not
claims that those gaps still exist.

## Prioritized proposals

### 1. Protect Worker routing with automated tests

**Why:** The Worker controls redirects, method restrictions, asset forwarding,
cache behavior, and security headers. At the time of the initial review, the
automated suite only tested color math; Worker tests have since been added.

**Proposal:** Add dependency-free Bun tests with a mocked `ASSETS` binding for
redirects, allowed and rejected methods, unknown paths, and headers on success
and error responses.

**Success measure:** `bun test` catches regressions in Worker routing without
requiring a deployed environment.

**Tracking:** [Worker router tests](https://github.com/senseikatana/hueplay/issues/2)

### 2. Add regression coverage for UI state and input

**Why:** Applying a color, handling invalid input, synchronizing controls, and
restoring shared URL state are central interactions but are not covered by
automated tests.

**Proposal:** Cover valid and invalid color application, query-string state,
numeric-field limits, and synchronization between previews and output.
Prefer the existing Bun test setup and avoid a new dependency unless a clear
need is demonstrated.

**Success measure:** Core UI state flows can be verified after changes without
relying only on manual testing.

**Tracking:** [UI interaction tests](https://github.com/senseikatana/hueplay/issues/3)

### 3. Announce meaningful dynamic status accessibly

**Why:** Visual changes to output and the out-of-gamut badge are not currently
announced as dynamic status to assistive technology.

**Proposal:** Expose useful status updates to screen readers while preventing
an announcement on every pointer movement. Announce gamut transitions and
provide a way to inspect updated output without changing the current keyboard
and focus behavior.

**Success measure:** Keyboard and screen-reader users can discover a gamut
transition and the updated result without a noisy stream of announcements.

**Tracking:** [Accessible dynamic status](https://github.com/senseikatana/hueplay/issues/4)

### 4. Make the first-run development guide reproducible

**Why:** At the initial review, the README's clone instructions pointed to a different repository and
directory, so a new contributor cannot reliably follow them.

**Proposal:** Correct the clone commands and verify the documented setup and
script names against a clean checkout.

**Success measure:** A contributor with Bun can clone this repository, run its
documented install and test commands, and start the local app.

**Tracking:** [Development instructions](https://github.com/senseikatana/hueplay/issues/1)

## Further ideas (not yet committed to the roadmap)

- Add a concise keyboard interaction guide for the dial and sliders.
- Test representative color conversions against an independent reference to
  guard against shared implementation/test assumptions.
- Improve small-screen layout and long CSS value readability based on user
  feedback.

These ideas need validation and prioritization before they become issues.
