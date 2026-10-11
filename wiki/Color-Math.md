# Color Math and Supported Input

## Conversion path

HSL colors are converted through sRGB to linear RGB, then to OKLab and its
polar form, OKLCH. Consequently, an HSL hue does not have one fixed OKLCH
equivalent: the equivalent depends on saturation and lightness as well as hue.
The inner ring's segment locations are derived from converting the HSL
primaries, not from a fixed hue lookup table.

The inverse hue mapping is ambiguous near some primaries. The current HSL hue
is preferred when it already maps to the requested rounded OKLCH hue, which
preserves exact HSL → OKLCH → HSL round trips in those cases.

## Chroma and gamut

For CSS `oklch()`, 100% chroma corresponds to an absolute chroma of `0.4`.
Values outside the sRGB gamut cannot be represented directly by an sRGB
display. The app keeps an entered OKLCH triple in the OKLCH controls, shows an
out-of-gamut warning, and uses a gamut-reduced RGB value for its HSL-side
conversion.

The formatter uses two decimal places to limit round-trip error. The gamut
tolerance and conversion details are covered by tests in `tests/color.test.mjs`.

## Accepted notation

The input accepts 3-, 4-, 6-, and 8-digit hex (with or without `#`), `rgb()` /
`rgba()`, `hsl()` / `hsla()`, and `oklch()` in modern or legacy separator
syntax. Alpha is ignored because the UI has no alpha channel.

CIE `lab()` and `lch()` are intentionally unsupported. Do not add them without
an explicit product decision: their D50-based coordinates and gamut behavior
are outside the current sRGB-focused scope.

## Tests

Run `bun test` to check reference values, hue round trips, RGB/OKLCH
round trips, parsing, formatting, and gamut detection.
