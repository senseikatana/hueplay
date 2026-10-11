// Punto de entrada único de la matemática de color.
//
// Esta lib no toca el DOM a propósito: los tests la importan directo y pueden
// correr las mismas aserciones que el navegador.

export type { Cmyk, Hsl, LinearRgb, Oklch, Rgb } from "./types";

export {
  CHROMA_UNIT,
  clamp,
  cmykToRgb,
  hslToRgb,
  inSrgbGamut,
  maxSrgbChroma,
  oklchToLinear,
  oklchToRgb,
  perceptualGrey,
  rgbToCmyk,
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
  formatDeviceCmyk,
  formatHex,
  formatHsl,
  formatOklch,
  parseCssColor,
  parseDeviceCmyk,
  parseHex,
  parseHsl,
  parseOkLch,
  parseOkLchTriple,
  parseRgb,
} from "./parse";
