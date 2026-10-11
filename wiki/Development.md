# Development

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
