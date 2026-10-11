# Deployment

Production uses a Cloudflare Worker with Static Assets, mounted at `/hueplay/*`
on `senseikatana.com` and `www.senseikatana.com`.

## Build and preview

```sh
bun install
bun run build
bun run preview
```

Astro generates static output in `dist/`. Its configuration sets
`base: "/hueplay"` and trailing slashes. The social preview image is sourced
from `public/preview.png`.

For source development, run `bun run dev` and open
`http://localhost:4321/hueplay/`. This is Astro's development server, not a
Worker runtime check.

## Production

```sh
bun run deploy
```

The deploy script runs Astro's build and Wrangler deployment.
`wrangler.jsonc` declares the custom domains and `ASSETS` binding.

The Worker redirects `/` and `/hueplay` to `/hueplay/`, serves assets below
that prefix, and returns 404 for unknown paths. Binding-generated redirects
must retain the prefix, including `/hueplay/historia` to
`/hueplay/historia/`.

Security headers apply to redirects, asset responses, and errors. Assets use
`Cache-Control: no-cache`. The CSP intentionally omits `script-src` to avoid
blocking Cloudflare challenge scripts.
