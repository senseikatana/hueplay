# Development

## Requirements

- [Bun](https://bun.sh/)
- A modern browser for manual UI checks

## Get started

```sh
git clone https://github.com/senseikatana/hueplay.git
cd hueplay
bun install
bun run dev
```

The local app is served at `http://localhost:8787/hueplay/`.

## Commands

| Command | Purpose |
| --- | --- |
| `bun test` | Run the color-math test suite. |
| `bun run build` | Copy the static site into `dist/`. |
| `bun run dev` | Run Wrangler locally; the configured build command prepares assets. |
| `bun run deploy` | Build and deploy the Worker. |

`dist/` is generated output and should not be edited. The HTML references
assets with relative paths (`./styles.css`, `./color.js`, `./index.js`) so the
site works at the `/hueplay/` subpath.

## Verification checklist

- Drag the dial and confirm both hue values, previews, and outputs update.
- Change HSL saturation or lightness and confirm the equivalent OKLCH hue is
  re-derived.
- Paste a valid color and confirm the controls and output chips agree; paste an
  invalid value and confirm the current state is unchanged.
- Paste an out-of-gamut `oklch()` value and confirm the warning appears.
- Use the numeric fields and keyboard navigation to check the slider values and
  focus indicators.

See [[Color Math]] for conversion and gamut constraints.
