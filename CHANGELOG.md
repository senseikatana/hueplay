# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] - 2026-10-11

Highlights: feat: add CMYK and MDN colours features and fix: the whole navigation on the history page pointed nowhere, plus 4 more changes.

- [x] 🚀 feat: add CMYK and MDN colours features
  - `src/components/ColorInput.astro`
  - `src/lib/color/convert.ts`
  - `src/lib/color/index.ts`
  - `src/lib/color/parse.ts`
  - `src/lib/color/types.ts`
  - `tests/color.test.ts`
- [x] 📝 docs: record the broken navigation in the changelog
- [x] 🐛 fix: the whole navigation on the history page pointed nowhere
  - `src/pages/historia.astro`
  - `src/pages/index.astro`
  - `tests/e2e/run.mjs`
- [x] 🧹 chore: nine scripts instead of twelve
  - `AGENTS.md`
  - `package.json`
- [x] 📦 build: make build a gate, and have preview and deploy go through it (#24)
  - `AGENTS.md`
  - `package.json`
  - `tests/e2e/run.mjs`
- [x] 🚀 feat: fold release check and sync into one command (#23)
  - `AGENTS.md`
  - `package.json`
  - `scripts/release.mjs`

## [0.3.3] - 2026-10-11

The changelog becomes the source of truth, and the tools that keep the releases
honest.

### Added

- **`bun run release:check`** — verifies that `package.json`, this changelog, the git tags
  and the GitHub releases agree, and that `main` is not above the newest tag without an
  `[Unreleased]` section recording it. The changelog drifted once already (a `0.3.1`
  section with no tag and no release, then a `0.3.2` re-listing the same commits), and
  nothing in the build noticed. The check is verified to fail against that exact drift.
- **`bun run release:sync`** — pushes each changelog section onto its GitHub release.
  `gh release create` writes an auto-generated commit list, which is not a changelog;
  the changelog is the source of truth and each release is a projection of it.

### Fixed

- The `0.3.2` changelog entry was a machine-generated commit list that repeated a block
  verbatim, re-listed content already shipped in the `0.3.0` tag, and duplicated a
  phantom `0.3.1`. It is now a real entry, and all three releases were re-synced from it.
- `main` sitting above the newest tag is normal between releases; the check reports it
  as a warning rather than an error, and only fails when unreleased commits are not
  recorded anywhere.

## [0.3.2] - 2026-10-11

Accessible announcements, a real end-to-end suite, contribution docs — and the three
regressions that suite caught on its first run.

> This release absorbs what an intermediate `0.3.1` section briefly described. That
> version was never tagged and never shipped; everything in it is here.

### Added

- **End-to-end test suite** (`bun run test:e2e`). 33 checks driving a real browser over the
  built site: dial drag, keyboard operation, URL restoration, numeric bounds, colour
  pasting, the gamut badge, the `aria-live` regions and the field guide. Zero new
  dependencies — the browser is driven over the DevTools Protocol using Node's built-in
  `WebSocket`.
  - It serves `dist/` with a small built-in static server rather than `astro preview`,
    because in Astro 7 `preview` runs as a daemon and leaves a zombie process behind when
    the run dies, which makes the result non-deterministic.
  - The browser is resolved through `PATH` instead of hardcoded system paths, and can be
    overridden with `CHROME_PATH`.
- **Announcements for screen-reader users** (issues #4, #5 and #11), with three rules:
  - Out-of-gamut is announced **only on transition**. Entering and leaving are spoken;
    repeating the same state on every frame says nothing.
  - The current colour is announced after a 400 ms debounce, so dragging a slider does not
    produce one announcement per frame.
  - Releasing a control, pressing an arrow key, or applying a colour announces
    immediately, so keyboard users are not made to wait out the debounce.
- **Contribution guidelines and a repository-backed wiki** covering development,
  architecture, colour math, deployment and improvement proposals.

### Fixed

All three were introduced during the Astro migration, and none was visible to the unit
suite — they only assert library behaviour, never the assembled page.

- **The out-of-gamut badge was inverted.** It was hidden exactly when the colour was out
  of gamut, and shown when it was in gamut — a stray negation while wiring up the
  announcements. The end-to-end suite caught it on its first run.
- **The OKLCH ring had an unpainted sector** (issue #19). The blue-to-magenta sector,
  264.1° to 328.4° — 64.3 degrees — was never drawn, so the inner wheel showed a hole
  where magenta should begin. The loop bound went from `length - 1` to `length - 2` while
  cleaning up `paintRings`; the original was correct.
- **Dragging died if the page scrolled mid-drag** (issue #18). The cached dial rect was
  nulled on scroll, and with it null the drag handler bailed out, so the dial stopped
  responding until you released and pressed again. It re-measures now, which only happens
  on resize or scroll.

### Changed

- Cleaned up the historical changelog formatting.
- `bun audit` is clean across 383 packages; the new dependencies are all dev-only.

## [0.3.0] - 2026-10-11

Migrated to Astro + TypeScript, added a field guide and an interactive demo, and fixed
the correctness bugs a full review surfaced.

### Added

- **Field guide** at `/hueplay/historia/`, built from Astro content collections. Four
  documents in Markdown: the history of colour models from Munsell (1905) to CSS Color 4
  (2023), why the hue axes don't align, the `100%` chroma trap, and gamut mapping.
- **"La mentira de la luminosidad"**, an interactive demo on the playground. Two rows of
  swatches at the same declared lightness, with a one-click grey test that removes chroma
  and isolates the effect. At 50% nominal lightness the HSL row spreads 49.0 points of
  real perceptual lightness (44.1%–93.1%); the OKLCH row spreads 0.0.
- `src/lib/color/convert.ts`: `gamutDeltaE()`, `maxSrgbChroma()` and
  `perceptualGrey()`.
- `tests/worker.test.ts` — the worker had **zero** tests, which is why the redirect-headers
  bug below survived.
- `bun run check` (`astro check`) and `bun run preview`.

### Fixed

- **The gamut badge lied.** It reused the 1e-2 tolerance that the chroma binary search
  genuinely needs, so it reported "in gamut" for colours the browser was visibly clipping.
  It is now perceptual: `ΔE_OK` against a 0.01 JND threshold. Pure red
  `oklch(62.8% 64.42% 29.23)` leaves `[0,1]` by ~4e-5 yet its ΔE is 0.00003 — a containment
  test would have flagged the most-used colour in the tool.
- **Grays printed a fabricated hue.** `formatOklch` emitted `atan2` noise, so `#808080`
  came out as `oklch(59.82% 0% 89.88)` — "0% chroma and a specific hue". Without chroma
  there is no hue, so it now emits `0`.
- **Redirects shipped no security headers.** `Response.redirect()` returns a bare response.
  A first visit over `http://` never received HSTS.
- **Shared URLs silently discarded `oklchHue`** — startup re-derived it from the HSL panel.
- **The dial was not keyboard-operable.** It is the primary control; it now has
  `role="slider"`, arrow / `Shift`+arrow / `Home` / `End`, and a synced `aria-valuenow`.
- Forced synchronous layout on every drag frame (read-after-write reflow). The dial rect
  is now cached and invalidated on resize/scroll.
- `history.replaceState` ran per event; Safari throws past ~100 calls / 30 s and the
  swallowed error meant the shareable URL stopped updating mid-drag. Now debounced, and
  it preserves the hash.
- Three WCAG AA contrast failures (`.input-note` 3.89:1, `::placeholder` 3.45:1,
  `.center-hub small` 4.49:1). Consolidated under a verified `--muted` token (4.61:1 worst
  case).
- `parseFloat` accepted trailing garbage, so `hsl(0 50zz% 50%)` parsed as a valid colour.
  The parser now follows the CSS grammar, and CSS angle units (`deg`/`grad`/`rad`/`turn`)
  parse properly instead of by accident.
- A second finger on the dial fought the first over the hue; only one pointer is tracked.
- `oklchHueToHslHue` could return `360`, making the panel and the chip print different
  strings for the same colour.
- Copy confirmation was not announced to screen readers; out-of-range numeric input gave
  no `aria-invalid`; the inline error was hidden rather than cleared.
- `?hslHue=` (empty value) reset the hue to 0 instead of being ignored.
- `oklchHueToHslHue` recomputed 360 full conversions per drag frame; the forward table is
  now memoised per `(s, l)`.
- `..` traversal check missed percent-encoding (`%2e%2e`), and an unguarded
  `env.ASSETS.fetch` returned the runtime's 1101 page with no security headers.
- `.github/` was silently ignored by the `.*` rule.
- An OSC-8 terminal escape had leaked into this file.
- Removed a dead `transition: background` on `.ring` (`background-image` is not
  interpolable) and replaced fixed `2rem` padding with `clamp()` (a 320px viewport left
  6px of slack).

### Security

From an AppSec review. **No exploitable vulnerability was found** — the app has no
auth, no database, no forms and no user-content sink. The hypotheses that were tested
and cleared: ReDoS in the colour parser, XSS via `innerHTML`, path traversal, and open
redirect.

- **`/hueplay/historia` was unreachable without a trailing slash.** With
  `html_handling: "auto-trailing-slash"`, the assets binding redirects
  `/historia` → `/historia/`, but composes that `Location` from the _site_ root, which
  does not know about Astro's `base: "/hueplay"`. The worker forwarded it verbatim, so
  a hand-typed or shared link without the trailing slash landed on a 404. The worker
  now re-applies the base to redirects the binding generates. Reproduced and fixed on
  the real `wrangler dev` runtime, not just against a mock.
- The `..` guard in the worker is bypassable as a _code invariant_ by double-encoding
  (`%252e%252e%252f` decodes once to `%2e%2e%2f`, which contains no literal `..`). It
  was not exploitable — the assets binding does not re-decode and is directory-scoped —
  but the comment claiming otherwise was wrong. Added a second layer that normalises the
  decoded path through `URL` before the binding ever sees it, and corrected the comment.
- `formatHex`, `formatHsl` and `formatOklch` could emit `NaN` into their output strings,
  because `clamp(NaN, …)` returns `NaN` and `NaN.toString(16)` is `"NaN"`. Not
  reachable through the UI, but the functions are public API.
- `parseOkLchTriple` only checked that its values were finite, not that they were in the
  range its own doc comment promises, so `oklch(1e5 0.15 30)` returned `l: 100000`. It
  now clamps to the documented range, which also makes the library agree with the
  sliders.

### Cleared, with measurements

- **ReDoS.** Every regex in the parser is strictly linear. Doubling the input roughly
  doubles the time (measured 1.93×, 1.98×, 1.99× on the three expensive paths);
  catastrophic backtracking would show well over 10×. `NUMBER_RE` has no nested
  unbounded quantifier over overlapping character classes. These measurements are now
  pinned as regression tests rather than kept as ad-hoc benchmarks.
- **XSS.** Exactly one `innerHTML` in the codebase (the demo's verdict line) and every
  interpolation is a `toFixed()` on a computed number, which cannot emit `<` or `&`.
  Everything user-influenced goes through `textContent`.
- **Open redirect.** The host allow-list rejects `senseikatana.com.evil.com`,
  `x.workers.dev.attacker.com` and the trailing-dot form. The `*.workers.dev` entry
  reflects the `Host` header, but `Host` is what routes the request in the first place,
  so it is a self-redirect rather than an attacker-controlled one.
- **Supply chain.** `bun audit` clean across 383 packages. All new dependencies are
  dev-only and none ships to the browser.
- **Build output.** No source maps, no secrets, no absolute build paths.

### Changed

- **Build:** Astro 7 (which bundles Vite) + TypeScript in strict mode with
  `noUncheckedIndexedAccess`. `color.js`/`index.js`/`index.html`/`styles.css` are gone,
  replaced by `src/lib/color/` (pure, DOM-free), `src/scripts/dial.ts` (the island),
  Astro components and content collections. `scripts/build.sh` is gone; `wrangler.jsonc`
  runs `astro build`.
- Dev server is `astro dev` on port **4321** (was `wrangler dev` on 8787).
- The inverse hue lookup memoises its 360-entry forward table, and the UI batches DOM
  writes into one `requestAnimationFrame`.
- Documentation: `AGENTS.md` and `README.md` rewritten for the new architecture, with the
  invariants and the manual verification checklist.

## [0.2.1] - 2026-10-11

### Changed

- Refreshed the development toolchain and package metadata.

### Maintenance

- Updated the repository guidance and project documentation.

## [0.2.0] - 2026-10-03

### Changed

- Moved the production mount path from `/showcase/*` to `/hueplay/*`.
- Replaced the hue lookup table with an actual sRGB → OKLab → OKLCH conversion,
  making the equivalent OKLCH hue depend on the current HSL color.
- Derived the inner dial ring's sector positions from converted sRGB primaries.
- Replaced the OKLCH hue slider's anchor stops with a full OKLCH hue gradient.
- Set `Cache-Control: no-cache` on asset responses because asset filenames are
  not fingerprinted.
- Removed the SPA fallback so unknown asset paths return a real 404.

### Added

- Pure color conversion, gamut, parsing, and formatting functions in `color.js`.
- Security headers on asset and error responses.
- A GET/HEAD-only method guard in the Worker.
- Safe asset-path reconstruction and allow-listed redirect origins.
- Accessible slider labels, visible keyboard focus indicators, canonical URL,
  and author metadata.

### Fixed

- Dial dragging now uses Pointer Events and ends correctly on cancellation.
- Clicking the center hub no longer sets an arbitrary hue.
- Removed redundant DOM lookups, unused synchronization state, and repeated
  construction of static hue gradients.
- Corrected the browser TypeScript/JavaScript configuration to use DOM types.
- Replaced placeholder author metadata and aligned the document title with the
  project name.

## [0.1.0] - 2026-10-03

### Added

- A draggable 360° dual-ring dial comparing HSL and OKLCH hue wheels.
- HSL and OKLCH control panels with independent hue, saturation/chroma, and
  lightness sliders.
- Live hue-slider gradients and CSS output for both color models.
- A hue mapping table with worked examples.
- A static HTML/CSS/JavaScript application with no runtime dependencies.
- A Cloudflare Worker with Static Assets, initially mounted at `/showcase/*`.
- Bun commands for local development, building, testing, and deployment.
