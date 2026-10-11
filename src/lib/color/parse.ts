// Parseo y formateo de notaciones de color CSS.
//
// Se acepta sintaxis moderna (`rgb(255 0 0)`, `rgb(255 0 0 / .5)`) y legada
// (`rgb(255, 0, 0)`). El alfa se lee pero se descarta: la herramienta no tiene
// canal alfa.
//
// CIE `lch()`/`lab()` NO está soportado, a propósito: son notaciones de
// impresión definidas contra el blanco D50 y gran parte de su gamut cae fuera de
// sRGB. Ver la sección de abajo para no reintroducirlo por error.

import {
  CHROMA_UNIT,
  clamp,
  hslToRgb,
  oklchToRgb,
  rgbToHsl,
  rgbToOklch,
} from "./convert";
import { roundHue } from "./hue-map";
import type { Oklch, Rgb } from "./types";

/** Debajo de esta croma no hay tono definido: es gris. */
const ACHROMATIC_C = 1e-4;

// ------------------------------------------------------------------- números
//
// `parseFloat` se come la basura final: `hsl(0 50zz% 50%)` parseaba como un
// color válido. Para un tool que rechaza `lch()` a propósito, ser tolerante en
// el resto de la sintaxis era incoherente. Este es el grammar de `<number>` de
// CSS y nada más.

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const strictFloat = (token: string): number => {
  const s = String(token).trim();
  if (!NUMBER_RE.test(s)) return Number.NaN;
  return Number.parseFloat(s);
};

/** `x%` -> pct/100*unit. Un número desnudo se toma tal cual. */
const readRatio = (tok: string, unit: number): number => {
  const s = String(tok).trim();
  if (s.endsWith("%")) {
    const v = strictFloat(s.slice(0, -1));
    return Number.isFinite(v) ? (v / 100) * unit : Number.NaN;
  }
  return strictFloat(s);
};

/**
 * `<angle>` de CSS: número con unidad opcional. Un número desnudo es grados,
 * que es lo que hace la sintaxis legada `hsl(0, 100%, 50%)`.
 *
 * Se parseaba por accidente antes: `parseFloat("240deg")` devolvía 240 y el
 * resto se ignoraba. Al endurecer el parser para rechazar basura, las unidades
 * reales de CSS tienen que entrar explícitamente.
 */
const readAngle = (tok: string): number => {
  const s = String(tok).trim();
  const m = s.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(deg|grad|rad|turn)?$/i,
  );
  if (!m || m[1] === undefined) return Number.NaN;
  const v = Number.parseFloat(m[1]);
  switch ((m[2] ?? "deg").toLowerCase()) {
    case "grad":
      return (v * 360) / 400;
    case "rad":
      return (v * 180) / Math.PI;
    case "turn":
      return v * 360;
    default:
      return v;
  }
};

// --------------------------------------------------------------- estructura

const matchFunc = (str: string, names: string[]): string | null => {
  const m = String(str)
    .trim()
    .match(/^([a-z]+)\((.*)\)$/is);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  if (!names.includes(m[1].toLowerCase())) return null;
  return m[2];
};

/** Máximo 4 argumentos: tres componentes y opcionalmente el alfa. */
const MAX_ARGS = 4;
const splitArgs = (inner: string): string[] => {
  const parts = inner
    .replace(/\//g, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  return parts.length > MAX_ARGS ? [] : parts;
};

// ------------------------------------------------------------------- parsers

export function parseHex(str: string): Rgb | null {
  const s = String(str).trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(s)) return null;
  let hex = s;
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((c) => c + c).join("");
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  const n = Number.parseInt(hex, 16);
  if (hex.length === 8) {
    return {
      r: ((n >>> 24) & 255) / 255,
      g: ((n >>> 16) & 255) / 255,
      b: ((n >>> 8) & 255) / 255,
      a: (n & 255) / 255,
    };
  }
  return {
    r: ((n >>> 16) & 255) / 255,
    g: ((n >>> 8) & 255) / 255,
    b: (n & 255) / 255,
    a: 1,
  };
}

export function parseRgb(str: string): Rgb | null {
  const inner = matchFunc(str, ["rgb", "rgba"]);
  if (inner === null) return null;
  const t = splitArgs(inner);
  if (t.length < 3) return null;
  const chan = (tok: string): number => {
    const s = String(tok).trim();
    if (s.endsWith("%")) {
      const v = strictFloat(s.slice(0, -1));
      return Number.isFinite(v) ? clamp(v / 100, 0, 1) : Number.NaN;
    }
    const v = strictFloat(s);
    return Number.isFinite(v) ? clamp(v / 255, 0, 1) : Number.NaN;
  };
  const r = chan(t[0] as string);
  const g = chan(t[1] as string);
  const b = chan(t[2] as string);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b, a: 1 };
}

export function parseHsl(str: string): Rgb | null {
  const inner = matchFunc(str, ["hsl", "hsla"]);
  if (inner === null) return null;
  const t = splitArgs(inner);
  if (t.length < 3) return null;
  const h = readAngle(t[0] as string);
  const s = readRatio(t[1] as string, 100);
  const l = readRatio(t[2] as string, 100);
  if (![h, s, l].every(Number.isFinite)) return null;
  const [r, g, b] = hslToRgb(h, s, l);
  return { r, g, b, a: 1 };
}

/** `oklch()` a color sRGB, recortando croma al gamut. */
export function parseOkLch(str: string): Rgb | null {
  const triple = parseOkLchTriple(str);
  if (triple === null) return null;
  const [r, g, b] = oklchToRgb(triple.l, triple.c, triple.h);
  return { r, g, b, a: 1 };
}

/**
 * El triple OKLCH TAL COMO ESTÁ ESCRITO (L 0..1, C 0..0.4+, H en grados), sin
 * recortarlo al gamut.
 *
 * Lo usa la UI para enseñar un oklch() fuera de gamut tal cual se tecleó y poder
 * encender el aviso "Fuera de Gamut" en lugar de mostrar un color distinto al
 * que el usuario pidió.
 */
export function parseOkLchTriple(str: string): Oklch | null {
  const inner = matchFunc(str, ["oklch"]);
  if (inner === null) return null;
  const t = splitArgs(inner);
  if (t.length < 3) return null;
  const L = readRatio(t[0] as string, 1);
  const C = readRatio(t[1] as string, CHROMA_UNIT);
  const H = readAngle(t[2] as string);
  if (![L, C, H].every(Number.isFinite)) return null;
  return { l: L, c: C, h: ((H % 360) + 360) % 360 };
}

/** Cualquier color CSS soportado -> sRGB, o null si no se reconoce. */
export function parseCssColor(str: string): Rgb | null {
  const s = String(str).trim();
  if (!s) return null;
  const bareHex =
    /^[0-9a-f]{3}$/i.test(s) ||
    /^[0-9a-f]{4}$/i.test(s) ||
    /^[0-9a-f]{6}$/i.test(s) ||
    /^[0-9a-f]{8}$/i.test(s);
  if (s.startsWith("#") || bareHex) return parseHex(s);
  return parseRgb(s) ?? parseHsl(s) ?? parseOkLch(s);
}

// ------------------------------------------------------------------ formato

/**
 * Quita ceros sobrantes: 50.00 -> "50", 62.7955 -> "62.8".
 *
 * Dos decimales NO son capricho: con uno la vuelta al color original se desvía
 * hasta 3.3/255 en los primarios; con dos, 0.4/255. Este número es load-bearing
 * y los tests lo fijan.
 */
const fmt = (n: number, d = 2): string => String(Number(n.toFixed(d)));

const clampInt = (x: number, lo: number, hi: number): number =>
  clamp(Math.round(x), lo, hi);

export function formatHex(r: number, g: number, b: number): string {
  const q = (v: number) =>
    clampInt(v * 255, 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${q(r)}${q(g)}${q(b)}`;
}

export function formatHsl(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  return `hsl(${clampInt(h, 0, 359)}, ${fmt(s)}%, ${fmt(l)}%)`;
}

/**
 * El triple OKLCH exacto del color, con croma en PORCENTAJE (que es lo que el
 * panel emite y lo que la gente copia).
 *
 * Nota sobre el gris: si la croma es ruido de punto flotante (~1e-8), el
 * `atan2` devuelve un ángulo de ruido — `#808080` salía como
 * `oklch(59.82% 0% 89.88)`. Eso afirma "0% de croma Y un tono concreto" y es una
 * contradicción visible en un tool que enseña. Sin croma no hay tono, así que se
 * emite 0, que es lo que el browser resuelve a un gris.
 */
export function formatOklch(r: number, g: number, b: number): string {
  const o = rgbToOklch(r, g, b);
  const hue = o.c < ACHROMATIC_C ? 0 : fmt(o.h);
  return `oklch(${fmt(o.l * 100)}% ${fmt((o.c / CHROMA_UNIT) * 100)}% ${hue})`;
}

export { CHROMA_UNIT, roundHue };
