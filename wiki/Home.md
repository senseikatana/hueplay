# Color Compass

Color Compass is a small, dependency-light playground for comparing HSL and
OKLCH colors. Astro builds static HTML, CSS, and vanilla TypeScript browser
interaction, served by a Cloudflare Worker at
[`senseikatana.com/hueplay/`](https://senseikatana.com/hueplay/).

## What you can do

- Paste a hex, `rgb()`, `hsl()`, or `oklch()` color and compare its values in
  both color models.
- Adjust hue, saturation/chroma, and lightness with sliders or numeric fields.
- Drag the dual-ring dial to change hue.
- Inspect the sRGB gamut warning and copy equivalent hex, HSL, and OKLCH values.
- Share the six-control state through the URL query string.
- Read the color-model field guide at `/hueplay/historia/`.

## Project guides

- [[Development]] — local setup, commands, and test workflow.
- [[Architecture]] — browser code, color math, and Worker routing.
- [[Color Math]] — conversion behavior, gamut, parser scope, and invariants.
- [[Deployment]] — build and Cloudflare Worker deployment.
- [[Improvement Proposals]] — prioritized, issue-tracked project improvements.

## Repository

Source code and issue tracking: [senseikatana/hueplay](https://github.com/senseikatana/hueplay).

Contribution guidelines: [CONTRIBUTING.md](https://github.com/senseikatana/hueplay/blob/main/CONTRIBUTING.md).
