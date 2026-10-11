# Deployment

The production site is a Cloudflare Worker with Static Assets, mounted at
`/hueplay/*` on `senseikatana.com` and `www.senseikatana.com`. It is not hosted
on GitHub Pages or Cloudflare Pages.

## Build

```sh
bun install
bun run build
```

The build script copies `index.html`, `styles.css`, `color.js`, and `index.js`
to `dist/`. It also copies `preview.png` when present. Static asset paths in
the HTML must remain relative so they resolve beneath `/hueplay/`.

## Local preview

```sh
bun run dev
```

Open `http://localhost:8787/hueplay/`. The Wrangler configuration runs the
build command before starting the local Worker.

## Production

```sh
bun run deploy
```

`wrangler.jsonc` declares the production custom domains. The Worker redirects
the domain root to `/hueplay/`, redirects `/hueplay` to `/hueplay/`, and serves
assets under that prefix. Unmatched paths return 404.

The Worker sets security headers on asset responses and error responses.
`Cache-Control: no-cache` is used because asset filenames are not fingerprinted.
The CSP intentionally omits `script-src` to avoid blocking Cloudflare challenge
scripts.
