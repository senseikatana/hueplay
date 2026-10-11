// Conversiones puras entre HSL, sRGB y OKLCH. Sin DOM, sin efectos: es la
// única capa que los tests necesitan para importar.
//
// La cadena canónica es sRGB -> linealizar -> XYZ(D65) -> OKLab -> polar.
// HSL entra por una puerta lateral (no es un espacio por sí mismo, es una
// reparametrización de sRGB), igual que CIELAB, que no está aquí a propósito.

import type { Cmyk, Hsl, LinearRgb, Oklch, Rgb } from "./types";

/**
 * En CSS Color 4, `100%` de croma en oklch() equivale a 0.4, no a 1.0. Es la
 * trampa clásica: escribir `oklch(60% 15% 29)` NO es lo mismo que
 * `oklch(60% 0.15 29)`.
 */
export const CHROMA_UNIT = 0.4;

export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

/** Función de transferencia sRGB, gamma -> lineal (IEC 61966-2-1). */
const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** Inversa de la transferencia: lineal -> gamma. */
const toSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

// --------------------------------------------------------------- HSL <-> sRGB

/** HSL (h en grados, s y l en porcentaje) -> sRGB en [0,1]. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** sRGB en [0,1] -> HSL con h en [0,360) y s/l en porcentaje. */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

// ------------------------------------------------------------- sRGB -> OKLCH

/** sRGB gamma -> OKLCH. Es la conversión real: sin tablas ni atajos. */
export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.hypot(A, B), h };
}

/**
 * Luminosidad perceptual (L de OKLab) de un color sRGB.
 *
 * Es la materia prima del demo "la mentira de la luminosidad": todos los
 * colores con la MISMA L declarada en OKLCH dan exactamente este número, y los
 * que declaran la misma L en HSL dan números desperdigados.
 */
export function rgbToOklabLightness(r: number, g: number, b: number): number {
  return rgbToOklch(r, g, b).l;
}

// ------------------------------------------------------------- OKLCH -> sRGB

/** OKLCH -> sRGB lineal, SIN recortar. Se sale de [0,1] si el color no existe. */
export function oklchToLinear(l: number, c: number, h: number): LinearRgb {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

/**
 * Tolerancia para la BÚSQUEDA de reducción de croma.
 *
 * Generosa a propósito. Los primarios sRGB viven justo en el borde del gamut y
 * el redondeo al formatear los empuja apenas fuera. En ese caso interesa
 * RECORRAR el exceso, no reducir croma, porque la croma no es monótona en el
 * gamut: el canal lineal es cúbico en C, así que cruza cero y vuelve, y una
 * búsqueda binaria sobre C converge al PRIMER cruce (p. ej. 0.266 en vez de
 * 0.313 para el azul) devolviendo un color muy distinto. 1e-2 deja margen de
 * sobra y los colores realmente fuera de gamut (exceso ~0.16) siguen reduciendo.
 *
 * OJO: subir o bajar este número no es una optimización, rompe los round trips.
 */
const GAMUT_SEARCH_EPS = 1e-2;

/**
 * Umbral de diferencia perceptual mínima en OKLab, por debajo del cual el
 * gamut mapping es indistinguible.
 *
 * No es arbitrario: ~0.01 es el piso del "just noticeable difference" en
 * OKLab. Es la respuesta honesta a la pregunta que la insignia tiene que hacer,
 * que no es "¿cabe exactamente en [0,1]?" sino "¿el navegador me va a mostrar
 * algo distinto de lo que escribí?".
 *
 * Importa porque la respuesta por contención lineal era inútil: un rojo puro
 * como `oklch(62.8% 64.42% 29.23)` se sale de [0,1] en ~4e-5 de luz lineal y
 * aun así ΔE = 0.00003 — invisible. Marcarlo "fuera de gamut" sería una falsa
 * alarma en el color más usado de la herramienta.
 */
const GAMUT_JND = 0.01;

const withinLinear = (lin: LinearRgb, eps: number): boolean =>
  lin[0] >= -eps &&
  lin[0] <= 1 + eps &&
  lin[1] >= -eps &&
  lin[1] <= 1 + eps &&
  lin[2] >= -eps &&
  lin[2] <= 1 + eps;

/** Contención estricta: para encontrar un BORDE de gamut, sin tolerancia. */
const withinLinearTight = (lin: LinearRgb): boolean =>
  lin[0] >= 0 &&
  lin[0] <= 1 &&
  lin[1] >= 0 &&
  lin[1] <= 1 &&
  lin[2] >= 0 &&
  lin[2] <= 1;

/** Coordenadas cartesianas OKLab, que es donde se mide la distancia. */
const toLab = (l: number, c: number, h: number) => {
  const rad = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
};

/**
 * Distancia ΔE_OK entre el triple pedido y el color que el navegador mostraría
 * tras el gamut mapping de CSS Color 4 (reducción de croma, L y H intactos).
 *
 * Cero significa que el navegador te da exactamente lo que pediste.
 */
export function gamutDeltaE(l: number, c: number, h: number): number {
  const wanted = toLab(clamp(l, 0, 1), c, h);
  const [r, g, b] = oklchToRgb(l, c, h);
  const got = rgbToOklch(r, g, b);
  const shown = toLab(got.l, got.c, got.h);
  return Math.hypot(wanted.L - shown.L, wanted.a - shown.a, wanted.b - shown.b);
}

/**
 * ¿El navegador va a mostrar algo distinto de lo que pedí?
 *
 * Predicado PERCEPTUAL, no de contención. Enciende la insignia "Fuera de Gamut"
 * sólo cuando la diferencia supera el umbral de percepción.
 */
export const inSrgbGamut = (l: number, c: number, h: number): boolean =>
  gamutDeltaE(l, c, h) <= GAMUT_JND;

/**
 * OKLCH -> sRGB en [0,1]. Si la croma no cabe, se reduce hasta que quepa
 * (preservando L y H), que es el gamut mapping que especifica CSS Color 4.
 */
export function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const L = clamp(l, 0, 1);
  const encode = (lin: LinearRgb): [number, number, number] =>
    lin.map((v) => clamp(toSrgb(clamp(v, 0, 1)), 0, 1)) as unknown as [
      number,
      number,
      number,
    ];

  if (withinLinear(oklchToLinear(L, c, h), GAMUT_SEARCH_EPS)) {
    return encode(oklchToLinear(L, c, h));
  }

  let lo = 0;
  let hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (withinLinear(oklchToLinear(L, mid, h), GAMUT_SEARCH_EPS)) lo = mid;
    else hi = mid;
  }
  return encode(oklchToLinear(L, lo, h));
}

/**
 * Croma máxima representable en sRGB para una luz y tono dados, conservando L y
 * H. Es el otro lado del gamut mapping: lo que el navegador se lleva cuando
 * le pides más croma de la que la pantalla puede dar.
 */
export function maxSrgbChroma(l: number, c: number, h: number): number {
  const L = clamp(l, 0, 1);
  if (c <= 0) return 0;
  if (withinLinearTight(oklchToLinear(L, c, h))) return c;
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (withinLinearTight(oklchToLinear(L, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Un sRGB sin croma con la luminosidad perceptual pedida. */
export const perceptualGrey = (lightness: number): Rgb => {
  const [r, g, b] = oklchToRgb(clamp(lightness, 0, 1), 0, 0);
  return { r, g, b, a: 1 };
};

// ------------------------------------------------------------------- sRGB <-> CMYK
//
// AVISO, LEÉ ESTO ANTES DE TOCAR NADA DE ESTA SECCIÓN.
//
// Esta conversión NO es colorimétrica y no puede serlo sin un perfil ICC, que
// es un archivo de kilobytes que el navegador no carga. Es la fórmula
// "ingenua" o de/tutorial, la que aparece en cualquier libro de impresión:
//
//   K = 1 - max(r, g, b)
//   C = (1 - r - K) / (1 - K)
//
// Es una reparametrización de sRGB, como HSL. Sirve para mostrar una tupla de
// tinta plausible; NO predice lo que sale de una impresora. `device-cmyk()` es
// device-dependent justamente por esto: el mismo `device-cmyk(0 81% 81% 30%)`
// da colores distintos según el equipo, y sin `@color-profile` el navegador
// no tiene forma de saber cuál.
//
// MDN dice, a octubre de 2026, que NINGÚN navegador soporta `device-cmyk()`.
// Por eso el chip de esta herramienta lo muestra como TEXTO y nunca lo pinta:
// ofrecerlo como color vivo sería ofrecer algo que no renderiza.

/**
 * sRGB en [0,1] -> CMYK con c/m/y/k en [0,1], por la fórmula ingenua.
 *
 * El caso `1 - K === 0` es el negro puro: la fórmula divide por cero ahí. La
 * convención estándar es que el negro se escribe `0 0 0 100%` (sin tinta de
 * color, todo el negro en K), que además es lo más barato de imprimir.
 */
export function rgbToCmyk(r: number, g: number, b: number): Cmyk {
  const R = clamp(r, 0, 1);
  const G = clamp(g, 0, 1);
  const B = clamp(b, 0, 1);
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  const inv = 1 / (1 - k);
  return {
    c: clamp((1 - R - k) * inv, 0, 1),
    m: clamp((1 - G - k) * inv, 0, 1),
    y: clamp((1 - B - k) * inv, 0, 1),
    k: clamp(k, 0, 1),
  };
}

/**
 * CMYK en [0,1] -> sRGB en [0,1], por la misma fórmula ingenua en sentido
 * inverso: `r = (1 - C) * (1 - K)`.
 *
 * Es la inversa exacta de `rgbToCmyk`, así que el round trip cierra salvo por
 * el redondeo a dos decimales del formateador, igual que el resto de la lib.
 */
export function cmykToRgb(
  c: number,
  m: number,
  y: number,
  k: number,
): [number, number, number] {
  const C = clamp(c, 0, 1);
  const M = clamp(m, 0, 1);
  const Y = clamp(y, 0, 1);
  const K = clamp(k, 0, 1);
  const w = 1 - K;
  return [clamp((1 - C) * w, 0, 1), clamp((1 - M) * w, 0, 1), clamp((1 - Y) * w, 0, 1)];
}
