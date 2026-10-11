# Contributing

Thanks for your interest in improving Color Compass. Contributions that make
the color behavior more accurate, the interface more accessible, or the
project easier to maintain are welcome.

## Before you start

- Check the open [issues](https://github.com/senseikatana/hueplay/issues) and
  existing [pull requests](https://github.com/senseikatana/hueplay/pulls) to
  avoid duplicating work.
- For a substantial behavior or architecture change, open an issue first to
  agree on the scope.
- Do not add runtime or development dependencies without discussing them in an
  issue first.
- Keep changes focused; do not edit generated `dist/` output.

## Development setup

Requirements: [Bun](https://bun.sh/) and a modern browser.

```sh
git clone https://github.com/senseikatana/hueplay.git
cd hueplay
bun install
bun test
bun run dev
```

The local app is available at `http://localhost:4321/hueplay/`.

Useful commands:

| Command           | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `bun test`        | Run the color-math and Worker assertions.     |
| `bun run check`   | Check Astro and TypeScript types.             |
| `bun run build`   | Build the static app with Astro into `dist/`. |
| `bun run dev`     | Run the app locally through Astro.            |
| `bun run preview` | Preview the built static app.                 |
| `bun run deploy`  | Build and deploy the Cloudflare Worker.       |

## Project constraints

- Keep Astro's static output and vanilla TypeScript interaction model; do not
  add a UI framework or runtime dependency without prior agreement.
- Respect Astro's `/hueplay` base when creating asset and navigation URLs.
- `src/lib/color/` owns pure color math and must remain free of DOM access.
- Route playground UI writes through `updateUI()` in `src/scripts/dial.ts`.
- Preserve the real sRGB → OKLab → OKLCH hue conversion. Do not replace it with
  a fixed hue lookup table.
- Keep CIE `lab()`/`lch()` unsupported unless the project owner explicitly
  approves changing that product decision.
- Do not change the `/hueplay` mount path, Worker `BASE`, or custom-domain
  routes without explicit approval.
- Do not add a `script-src` directive to the Worker CSP; Cloudflare challenge
  scripts rely on the current policy.

## Tests and manual checks

Run `bun test` for changes to color math or parsing. For UI or Worker changes,
run `bun run check`, the relevant tests and, when possible, `bun run dev` to verify the changed
behavior in a browser.

For color behavior, also check the relevant documented invariants and example
colors in `README.md` and `src/content/docs/`. For UI changes, check keyboard focus, mobile layout,
color input errors, gamut warnings, and whether the sliders and output stay in
sync.

## Pull requests

Please include:

- A concise description of the user-visible or maintenance change.
- The issue number(s) addressed, if applicable.
- Tests or manual verification performed and any limitations.
- Updated `README.md` and `CHANGELOG.md` when behavior, supported input, or
  deployment behavior changes.

Keep pull requests focused and avoid bundling unrelated formatting or cleanup.
