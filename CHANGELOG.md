# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

Maintenance release with 2 changes.

- [x] 📦 build(bun.lock): add eslint and wrangler to package.json
  - `bun.lock`
  - `package.json`
- [x] 🔹 chore: upgrade Bun to v1.4.3 (c6da4a4d3)
  - `.gitignore`
  - `AGENTS.md`
  - `LICENSE`
  - `README.md`
  - `bun.lock`
  - `color.js`
  - `index.html`
  - `index.js`
  - `jsconfig.json`
  - `package.json`
  - `preview.png`
  - `scripts/build.sh`
  - `styles.css`
  - `tests/color.test.mjs`
  - `worker.js`
  - `wrangler.jsonc`

## [0.2.0] - 2026-10-03

### Changed

- **Mount path moved from `/showcase/*` to `/hueplay/*`.** The old URL is gone; `README.md`,
  `index.html` (canonical and OG/Twitter URLs) and `worker.js` all point at the new path.
- **The hue mapping is now a real conversion instead of a lookup table.** New `color.js` runs
  sRGB → linearize → OKLab → OKLCH for the color described by the HSL panel, so the OKLCH hue
  is correct for any saturation and lightness rather than only for the six sampled anchors.
  The previous table was up to 31.6° off (yellow reported 90° against a true 109.8°, magenta
  360° against 328.4°, mean error 14.3°).
- The OKLCH hue re-derives whenever the HSL saturation or lightness changes, because OKLCH hue
  is a property of the whole color, not of the hue angle alone.
- The inner ring paints the six HSL primaries at their true OKLCH hues (29.2°, 109.8°, 142.5°,
  194.8°, 264.1°, 328.4°), so its sectors are correctly uneven.
- The OKLCH hue slider track is now a full OKLCH hue wheel instead of a stop list keyed to the
  old table.
- `Cache-Control: no-cache` for every asset — the filenames carry no fingerprint, so
  revalidation is the honest policy (`max-age=300` could serve stale JS for five minutes after
  a deploy).
- Unknown paths now return a real **404**; the `single-page-application` fallback was removed
  from `wrangler.jsonc` because there is no client-side routing (it used to serve `index.html`
  with a 200 for missing `.js` and `.css` files).

### Added

- `color.js`: pure color module (`hslToRgb`, `rgbToOklch`, `oklchToRgb`, forward and inverse
  hue mapping, chroma reduction for out-of-gamut values). It has no DOM access, so it can be
  imported from Node for assertions.
- Security headers on every response, including 404s and 405s: `Content-Security-Policy`
  (`frame-ancestors 'none'; base-uri 'none'; form-action 'none'`), `X-Frame-Options: DENY`,
  `Permissions-Policy` and `Strict-Transport-Security`.
- `HEAD`/`GET`-only guard in the worker (405 with an `Allow` header otherwise).
- The worker rebuilds the asset path instead of slicing it, so `//host` and `..` cannot reach
  the `ASSETS` binding, and redirects derive from a fixed allow-list of hostnames instead of
  reflecting the request `Host`.
- Accessible slider labels (`aria-labelledby` pointing at the visible control label) and a
  `:focus-visible` outline — the sliders previously had `outline: none` with no replacement.
- `<link rel="canonical">` and a real `<meta name="author">`.

### Fixed

- The dial no longer gets stuck: the drag moved to Pointer Events with `setPointerCapture` and
  now also ends on `pointercancel`, instead of relying on `mouseup`/`touchend` alone.
- Clicks inside the dial hub no longer throw the pointer to an arbitrary angle.
- Removed the dead `isSyncing` guard (programmatic `.value =` never fires `input`), the
  per-event `getElementById` lookups, and the two static hue gradients that were rebuilt on
  every frame.
- `jsconfig.json` now loads the DOM libraries; it previously declared `jsx: "react-jsx"` and
  `types: ["bun"]` for a project that uses neither, so `strict` never applied to the browser
  code.
- `index.html` no longer ships the placeholder author and its title now matches `README.md`.

## [0.1.0] - 2026-10-03

Initial release.

### Added

- 360° dual-ring dial: drag to set the hue; the outer ring shows the HSL wheel, the inner ring shows the OKLCH wheel, and both sliders stay synchronized.
- Dual control panels with independent sliders: Hue, Saturation and Lightness for HSL; Hue, Chroma and Lightness for OKLCH.
- Live gradient tracks on both hue sliders (sRGB primaries for HSL, OKLCH anchor hues for OKLCH).
- Real-time CSS output: the `hsl()` and `oklch()` strings update next to their color swatches as you drag or slide.
- Piecewise-linear HSL ↔ OKLCH hue mapping table (`map` in `index.js`), documented with worked examples in `README.md`.
- Zero-dependency implementation: plain HTML, CSS and vanilla JavaScript — no framework, no bundler.
- Cloudflare Worker with Static Assets serving the playground on `/showcase/*` of `senseikatana.com`, including root redirects, SPA fallback, cache control and security headers.
- `bun run dev`, `bun run build` and `bun run deploy` scripts backed by Wrangler.
