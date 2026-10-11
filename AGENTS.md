# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

Color Compass (package name: `hueplay`) is a teaching tool that compares the HSL and
OKLCH colour models. It has two pages:

- `/hueplay/` — the playground: a 360° dual-ring dial, two slider panels, a colour
  input that accepts any CSS colour notation, exact equivalence chips, live CSS
  output, and an interactive demo called _La mentira de la luminosidad_.
- `/hueplay/historia/` — a field guide to the colour models, written in Markdown and
  built from Astro content collections.

Deployed as a Cloudflare Worker with Static Assets on `https://senseikatana.com/hueplay/*`.

## Architecture

- **Astro 7** (which bundles Vite) with **TypeScript** in `strict` mode. Output is
  static HTML into `dist/`.
- `src/lib/color/` owns **all** colour maths and has **no DOM access**, so `bun test`
  imports it directly. It is the only place conversions are allowed to live.
- `src/scripts/dial.ts` is the playground's interactive island. It owns the DOM, the
  pointer drag and the keyboard handling. Vanilla TypeScript — no framework, no
  component runtime.
- `src/content/docs/*.md` is the history page, as Astro content collections. The
  schema lives in `src/content.config.ts`; frontmatter order drives the index.
- `worker.js` is the edge router: redirects `/` and `/hueplay`, strips the
  `/hueplay` prefix, forwards to `env.ASSETS`, and sets security headers on
  **every** response, including redirects, 404s and 405s.
- `astro.config.mjs` sets `base: "/hueplay"`. **Never hardcode `/` for an asset
  path** — Astro prefixes it, and the edge router strips the prefix on the way in.
  `public/` is served from the site root, so `public/preview.png` becomes
  `/hueplay/preview.png`.

## Directory map

| Path                       | Role                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `src/lib/color/convert.ts` | sRGB ↔ HSL ↔ OKLab ↔ OKLCH, gamut mapping, perceptual lightness         |
| `src/lib/color/hue-map.ts` | Hue forward/inverse, with a memoised forward table                      |
| `src/lib/color/parse.ts`   | CSS colour parsing and formatting                                       |
| `src/lib/color/types.ts`   | Shared types (`Rgb`, `Hsl`, `Oklch`, `LinearRgb`)                       |
| `src/scripts/dial.ts`      | Playground island: dial drag, `updateUI()`, URL state, chips, clipboard |
| `src/components/`          | Astro components (`Dial`, `Panel`, `ColorInput`, `LightnessLie`)        |
| `src/content/docs/`        | The history page, in Markdown                                           |
| `src/content.config.ts`    | Content collection schema — use `astro/zod`, not `astro:content`        |
| `src/styles/global.css`    | Every token and style. `--muted` is the verified AA text colour         |
| `worker.js`                | Edge router for `/hueplay/*`                                            |
| `tests/color.test.ts`      | Conversions, parser, round trips, gamut semantics                       |
| `tests/worker.test.ts`     | Routing, security headers, traversal, redirect allow-list               |
| `tests/e2e/run.mjs`        | Browser checks over the built site: drag, keyboard, URL, `aria-live`    |
| `dist/`                    | Build output (git-ignored), served as assets                            |

## Commands

```bash
bun install      # once
bun run dev      # astro dev
bun run check    # types only
bun run test     # unit tests only
bun run e2e      # end-to-end only; needs a prior build
bun run build    # check -> test -> build -> e2e, stops at the first failure
bun run build:preview  # build (fully gated) -> serve it
bun run build:deploy   # build (fully gated) -> Cloudflare
bun run release  # check -> sync -> check, in one command
```

There is no separate `verify` — `check` and `test` are one command apart and `build`
chains them. There is no `release:check` / `release:sync` either: `release` is the entry
point and calls the underlying scripts by path.

### A routing difference you will trip over

`bun run dev` and `bun run build:preview` both **404 on `/hueplay/historia`** with no
trailing slash. Production does not: the Worker's `auto-trailing-slash` redirects it to
`/hueplay/historia/`, which is the bug fixed in 0.3.2 and covered by the end-to-end
suite, whose own server replicates the 307.

This is Astro's dev/preview server, not the scripts. `dev` and `preview` behave
identically, so it will not surprise you when switching between them — but when checking
a link someone shared, use the slashed form locally.

`astro dev` serves on **4321**, not 8787. The `base: "/hueplay"` means the dev URL is
`http://localhost:4321/hueplay/`.

`bun run test:e2e` is separate from `bun test` on purpose: it needs a build, a server and
a real DOM. It serves `dist/` with a small built-in static server rather than
`astro preview`, because in Astro 7 `preview` runs as a daemon and leaves a zombie
process behind if the test dies, which makes the run non-deterministic. Set
`CHROME_PATH` if the browser is not on `PATH`.

## Releasing

The **CHANGELOG is the source of truth**; each GitHub release is a projection of its
matching section. That invariant has already broken once — a `0.3.1` section existed
with no tag and no release, and `0.3.2` then re-listed the same commits — so the
drift is checked, not remembered:

1. Edit `CHANGELOG.md`, and bump `package.json` in the same commit. Every version in
   the CHANGELOG needs a tag, or the section is a phantom.
2. `bun run release:check` — fails if `package.json`, the CHANGELOG, the tags and the
   GitHub releases disagree, or if a ref is above the newest tag without an
   `[Unreleased]` section recording it. `RELEASE_REF=origin/dev` checks another branch.
3. Merge to `main`, tag, then `bun run release` — one command that syncs every release
   and re-checks afterwards. `gh release create` writes an auto-generated commit list by
   default, which is not a changelog; the sync overwrites it with the real text.

`bun run release` refuses to sync when the first check fails. A missing tag or a version
with no section is not something syncing can fix, and doing it anyway would push a
changelog onto a release that should not exist.

`0.1.0` and `0.2.0` predate the available git history and cannot be tagged; they are
listed as `UNTAGGED_BY_DESIGN` in `scripts/check-release.mjs` so the rule keeps its
teeth for everything that comes after.

## Code conventions

- English identifiers (`hslHueToOklchHue`, `updateUI`); comments in **Spanish**, only
  where the code is not self-explanatory. Comments explain _why_, not _what_.
- `src/lib/color` must stay DOM-free. If you need a DOM, put it in `src/scripts`.
- No runtime dependencies. Everything here is a `devDependency`.
- Do not add a UI framework. The dial is a pointer drag plus maths; a framework
  would be slower and larger for no benefit.

## Colour-mapping constraint

Hue equivalence is a **real conversion**, not a lookup table: the library runs
sRGB → linearize → OKLab → polar for the colour the HSL panel describes. Any change
here must keep four things consistent:

1. `hslHueToOklchHue` / `oklchHueToHslHue` in `src/lib/color/hue-map.ts`;
2. the anchor and worked-example tables in `src/content/docs/02-mapeo-hue.md`;
3. the ring stops built from `primaryOklchHues()` in `src/scripts/dial.ts`;
4. the `docs/04-gamut.md` ceiling table.

Because OKLCH hue depends on saturation and lightness too, the mapping is **not** a
function of the hue angle alone — do not "simplify" it into a table. The inverse is
intentionally ambiguous near the primaries (a 10-15° span of HSL hue collapses into
one OKLCH degree around blue); `oklchHueToHslHue` resolves that by recognising the
current hue first, so the HSL → OKLCH → HSL round trip stays exact.

**CIE `lch()`/`lab()` is deliberately NOT implemented.** It was built and removed:
those notations are defined against the **D50** white point (ICC/print) and much of
their gamut is outside sRGB, so it is not shippable for web work. Do not reintroduce
it without an explicit decision from the owner. The tool stays on sRGB-reachable
coordinates: `#hex`, `hsl()`, `oklch()`.

## Three invariants the tests guard — do not "optimise" them

- **`GAMUT_SEARCH_EPS = 1e-2` in `oklchToRgb` is load-bearing.** The sRGB primaries sit
  exactly on the gamut boundary and formatting pushes them out. Chroma reduction is
  _invalid_ there, because the linear channel is _cubic_ in chroma, so the in-gamut
  set is not an interval and a binary search converges to the wrong crossing.
  Changing it breaks round trips.
- **The formatters use two decimals on purpose.** One decimal loses up to 3.3/255 on
  round trip; two loses 0.4/255.
- **The gamut badge is perceptual, not a containment test.** `inSrgbGamut` compares
  `ΔE_OK` (OKLab distance between what you asked for and what the browser will
  actually paint) against `GAMUT_JND = 0.01`. A containment test is wrong here: pure
  red `oklch(62.8% 64.42% 29.23)` leaves `[0,1]` by ~4e-5 in linear light yet its ΔE is
  0.00003. Flagging it would be a false alarm on the most-used colour in the tool.

### One subtlety that has already caused a wrong fix

The equivalence chips are the conversion of **the colour on screen**, which is the
rounded slider value — not of the exact hex you pasted. `#ffd000` is hue 48.941, the
slider shows 49, and the two give `oklch(87.3% …)` and `oklch(87.35% …)` respectively.
The `#hex` chip is identical either way, so it never reveals the difference. This is
correct; there are tests pinning both values. Do not "fix" it.

## Verification

1. `bun test` — 71 tests, ~37k assertions. Anything touching `src/lib/color` must leave
   it green.
2. `bun run check` — zero type errors.
3. `bun run test:e2e` — 33 checks in a real browser. This is the one that catches assembled-
   page bugs the unit suite cannot see: it has already caught an inverted gamut badge.
4. `bun run dev` and load `http://localhost:4321/hueplay/`.
5. Drag the dial: the pointer, both hue sliders, both swatches and both code strings
   move together.
6. Round trip: set an HSL hue, note the OKLCH hue, drag the OKLCH hue slider back onto
   that number — the HSL hue returns to where it started.
7. Move HSL saturation: the OKLCH hue re-derives. It is derived from the colour, not
   copied.
8. Set HSL saturation to 0%: nothing breaks, and the OKLCH hue **freezes at its last
   value** — it does not reset to 0.
9. Paste `#ffd000`: the field normalises to `#ffd000`, the chips read
   `oklch(87.35% 44.68% 92.34)`. Paste garbage: an inline error appears and the state is
   untouched. Paste `oklch(50% 100% 30)`: the panel keeps those numbers and the
   **Fuera de Gamut** badge lights up. Paste `lch(…)`: rejected inline.
10. Paste `#ff0000`: the badge must **stay dark**. This is the regression test for the
    ΔE predicate.
11. Type into a numeric field: the slider and the other panel follow. Type `999`: the
    field gets `aria-invalid="true"` and nothing moves until blur, then it clamps.
12. Keyboard: `Tab` reaches the input, the button, the chips, every slider **and the
    dial**. Focus the dial and press arrows / `Shift`+arrows / `Home` / `End`.
13. Share a URL with all six params, reload, and confirm all six are restored — including
    `oklchHue`, which is easy to clobber by re-deriving it.
14. Open `/hueplay/historia/`: four documents render, the timeline cards link to working
    anchors, and tables/code blocks are styled.
15. Open `/hueplay/historia` **without the trailing slash** and follow the redirect. It
    must land on `/hueplay/historia/` and return 200. This is the one that regressed:
    `auto-trailing-slash` composes its `Location` from the site root, which does not
    know about `base: "/hueplay"`, so the worker has to re-apply the prefix. If you
    change `html_handling`, the mount path or the base, re-check this — testing only
    the slashed form is exactly what let it through.

## Rules

- Ask before adding any dependency (runtime or dev).
- Do not change the `/hueplay` mount path, `BASE` in `worker.js`, or the `custom_domain`
  routes without an explicit request.
- Do not edit build output (`dist/`, `.astro/`, `.wrangler/`, `node_modules/`).
- Update `README.md` and `CHANGELOG.md` whenever behaviour or the mapping changes.
- Do not add a `script-src` directive to the worker's CSP. Cloudflare's challenge
  platform injects inline scripts (JavaScript Detections) when a zone challenge is
  active, and a strict `script-src` breaks it. The CSP deliberately covers only
  `frame-ancestors`, `base-uri` and `form-action`.
- Security headers belong on **every** response. `Response.redirect()` does not carry
  them — use the `redirect()` helper in `worker.js`. HSTS on the redirect is what
  protects a first visit over `http://`.
