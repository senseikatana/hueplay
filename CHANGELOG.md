# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-11

### Changed

- Refreshed the development toolchain and package metadata.

### Maintenance

- Updated the repository guidance and project documentation.

## [0.2.0] - 2026-10-03

### Changed

- Moved the production mount path from `/showcase/*` to `/hueplay/*`.
- Replaced the hue lookup table with an actual sRGB → OKLab → OKLCH conversion,
  making the equivalent OKLCH hue depend on the current HSL color.
- Derived the inner dial ring's sector positions from converted sRGB primaries.
- Replaced the OKLCH hue slider's anchor stops with a full OKLCH hue gradient.
- Set `Cache-Control: no-cache` on asset responses because asset filenames are
  not fingerprinted.
- Removed the SPA fallback so unknown asset paths return a real 404.

### Added

- Pure color conversion, gamut, parsing, and formatting functions in `color.js`.
- Security headers on asset and error responses.
- A GET/HEAD-only method guard in the Worker.
- Safe asset-path reconstruction and allow-listed redirect origins.
- Accessible slider labels, visible keyboard focus indicators, canonical URL,
  and author metadata.

### Fixed

- Dial dragging now uses Pointer Events and ends correctly on cancellation.
- Clicking the center hub no longer sets an arbitrary hue.
- Removed redundant DOM lookups, unused synchronization state, and repeated
  construction of static hue gradients.
- Corrected the browser TypeScript/JavaScript configuration to use DOM types.
- Replaced placeholder author metadata and aligned the document title with the
  project name.

## [0.1.0] - 2026-10-03

### Added

- A draggable 360° dual-ring dial comparing HSL and OKLCH hue wheels.
- HSL and OKLCH control panels with independent hue, saturation/chroma, and
  lightness sliders.
- Live hue-slider gradients and CSS output for both color models.
- A hue mapping table with worked examples.
- A static HTML/CSS/JavaScript application with no runtime dependencies.
- A Cloudflare Worker with Static Assets, initially mounted at `/showcase/*`.
- Bun commands for local development, building, testing, and deployment.
