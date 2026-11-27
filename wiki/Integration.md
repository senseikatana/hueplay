# Integration

This page is reserved for optional katanakit-js integrations.

Hueplay is intentionally dependency-light (**AGENTS.md**: "No runtime
dependencies"). `src/index.ts` currently contains no katanakit-js import and
color math stays DOM-free in `src/lib/color/`.

If you wire katanakit-js in, place the typed client setup in `src/index.ts`:

```ts
import { defineApiConfig, type ApisConfig } from "katanakit-js";

defineApiConfig({
  // endpoints, baseUri, and typed queries go here
}) as ApisConfig;
```

Keep katanakit-js tooling out of color conversion (`src/lib/color/`), which must
remain DOM-free and importable directly by Bun tests.

## Tools

- `defineApiConfig` / `ApisConfig` — declare the typed HTTP client once at module
  scope.
- `useGetApi`, `usePostApi`, etc. — typed request helpers; narrow on `result.ok`.
- Query client, framework adapters (Astro, Vue, React, etc.) — optional peer
  dependencies; install only the integration you use.

Documentation for the toolkit itself now lives at https://samuraicoder.dev (the
`docs.senseikatana.com` route changed domain and is not hosted there yet).
