# Architecture

Color Compass uses Astro 7 and strict TypeScript to build a static site. Browser
interaction uses vanilla TypeScript, with no UI framework runtime.

## Pages and components

- `src/pages/index.astro` contains the playground.
- `src/pages/historia.astro` renders the color-model field guide.
- `src/components/` contains the dial, panels, color input, and lightness demo.
- `src/content/docs/` stores field-guide Markdown, validated by the content
  collection schema in `src/content.config.ts`.
- `src/styles/global.css` owns the shared styles and tokens.

## Color and UI state

`src/lib/color/` owns conversion, hue mapping, parsing, formatting, and shared
types. It has no DOM access and is imported directly by Bun tests.

`src/scripts/dial.ts` owns interaction, coordinated UI updates, clipboard
feedback, and URL state. Equivalent hue is derived from the current HSL color,
not copied between panels. The six control values are stored in the query
string; URL updates are debounced and preserve the hash.

## Build and routing

`astro.config.mjs` sets the `/hueplay` base and builds static assets into
`dist/`. `public/preview.png` is the social preview image.

`worker.js` routes requests under `/hueplay/*`, permits GET and HEAD, and
forwards assets to `env.ASSETS`. It applies security headers to responses,
including redirects and errors. Binding-generated redirects are adjusted to
preserve the mount prefix. Unknown paths return 404 without an SPA fallback.

See [[Deployment]] for production commands and [[Development]] for checks.
