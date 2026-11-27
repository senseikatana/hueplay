# Development & Deployment

## Get started

Install [Bun](https://bun.sh/) and use a modern browser for UI checks.

```sh
git clone https://github.com/senseikatana/hueplay.git
cd hueplay
bun install
bun test
bun run dev
```

The Astro development server serves `http://localhost:4321/hueplay/`.

## Commands

| Command           | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `bun test`        | Run color-math and Worker routing tests. |
| `bun run check`   | Check Astro and TypeScript types.        |
| `bun run build`   | Build static output into `dist/`.        |
| `bun run dev`     | Start Astro's development server.        |
| `bun run preview` | Preview the built site.                  |
| `bun run deploy`  | Build and deploy the Cloudflare Worker.  |

Do not edit generated `dist/`, `.astro/`, or `.wrangler/` output. Respect
Astro's configured `/hueplay` base in navigation and asset URLs.

## Manual checks

Check dial dragging and keyboard controls, synchronized hue values, color
input errors, numeric bounds, clipboard feedback, and URL restoration. Verify
the field guide both with and without the trailing slash at
`/hueplay/historia/`.

The detailed verification checklist and conversion invariants live in
`AGENTS.md` and `README.md`. See [[Color Math]] for color behavior.

---

## Deployment

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
