// Punto de entrada único de la matemática de color.
//
// Esta lib no toca el DOM a propósito: los tests la importan directo y pueden
// correr las mismas aserciones que el navegador.

export type { Hsl, LinearRgb, Oklch, Rgb } from "./types";

export {
  CHROMA_UNIT,
  clamp,
  hslToRgb,
  inSrgbGamut,
  maxSrgbChroma,
  oklchToLinear,
  oklchToRgb,
  perceptualGrey,
  rgbToHsl,
  rgbToOklabLightness,
  rgbToOklch,
} from "./convert";

export {
  clearHueCache,
  hslHueToOklchHue,
  oklchHueToHslHue,
  primaryOklchHues,
  roundHue,
} from "./hue-map";

export {
  formatHex,
  formatHsl,
  formatOklch,
  parseCssColor,
  parseHex,
  parseHsl,
  parseOkLch,
  parseOkLchTriple,
  parseRgb,
} from "./parse";
