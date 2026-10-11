# Architecture

The application is deliberately a static, no-framework browser app with a
small Cloudflare Worker router.

## Browser

- `index.html` contains the controls, color previews, output chips, and
  accessible labels.
- `styles.css` defines the layout, color rings, slider tracks, and focus
  indicators.
- `color.js` contains the pure color conversion, gamut, parsing, and formatting
  functions. It exposes the `ColorMath` global and has no DOM dependency.
- `index.js` owns DOM state, input listeners, dial pointer handling, UI
  rendering, clipboard behavior, and URL state.

Scripts are loaded directly as classic scripts; there is no bundler or
framework. UI updates are coordinated through `updateUI()`.

## Color state

The UI keeps separate HSL and OKLCH controls. The equivalent hue is computed
from the current color rather than copied between panels: changes to HSL
saturation or lightness can therefore change the OKLCH hue. Pasting an
`oklch()` value also preserves the entered OKLCH triple so the interface can
show an out-of-gamut value and warn about it.

The six control values are written to the query string with
`history.replaceState`, allowing a URL to reproduce the current state without
adding an entry for every slider movement.

## Worker

`worker.js` routes the app under `/hueplay/*`, redirects `/` and `/hueplay`,
allows only GET and HEAD, forwards asset requests to `env.ASSETS`, and applies
security headers. Unknown paths return 404; there is no SPA fallback. The
Worker reconstructs asset paths rather than forwarding an untrusted path
directly.

`wrangler.jsonc` configures the Worker, static assets in `dist/`, and the
production custom domains. See [[Deployment]] before deploying.
