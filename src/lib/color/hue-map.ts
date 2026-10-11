// Mapeo de tono entre HSL y OKLCH.
//
// Esto NO es una tabla de traducción. La equivalencia es una conversión real
// del color que describe el panel HSL: sRGB -> linealizar -> OKLab -> atan2.
// Y como OKLCH depende del color entero, la equivalencia también depende de la
// saturación y la luz, no sólo del ángulo.

import { hslToRgb, rgbToOklch } from "./convert";

/**
 * Debajo de esta croma el color es acromático y el tono no está definido: es
 * el mismo gris para todos los ángulos.
 */
const ACHROMATIC_C = 1e-4;

const circularDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Tono entero en [0,360), igual que lo que almacena un slider. */
export const roundHue = (x: number): number => ((Math.round(x) % 360) + 360) % 360;

/**
 * Tono OKLCH del color hsl(h,s,l), o null si el tono no está definido.
 *
 * Se satura o se pone blanco/negro, no hay tono que reportar.
 */
function hslHueToOklchHueRaw(h: number, s: number, l: number): number | null {
  if (s <= 0 || l <= 0 || l >= 100) return null;
  const [r, g, b] = hslToRgb(h, s, l);
  const o = rgbToOklch(r, g, b);
  return o.c < ACHROMATIC_C ? null : o.h;
}

export const hslHueToOklchHue = hslHueToOklchHueRaw;

// ------------------------------------------------- memoización de la inversa
//
// `oklchHueToHslHue` tiene que recorrer los 360 tonos HSL porque la relación no
// es inyectiva: cerca de los primarios, 10-15° de HSL se aplanan en un solo
// grado de OKLCH. Con la tolerancia generosa de la búsqueda it'd cost 360
// conversiones sRGB->OKLab por frame de arrastre.
//
// s y l vienen de sliders enteros, así que hay pocos pares distintos en una
// sesión: la tabla se calcula una vez por par y se reutiliza. Bounded para que
// una URL compartida con parámetros raros no crezca sin límite.

const CACHE_LIMIT = 32;
const forwardCache = new Map<string, Float64Array | null>();

/**
 * Tabla de 360 tonos HSL -> OKLCH para un par (s,l) fijo.
 * `NaN` marca los tonos sin equivalente definido (acromáticos).
 */
function forwardTable(s: number, l: number): Float64Array | null {
  if (s <= 0 || l <= 0 || l >= 100) return null;

  const key = `${s}|${l}`;
  const cached = forwardCache.get(key);
  if (cached !== undefined) return cached;

  const table = new Float64Array(360);
  for (let h = 0; h < 360; h++) {
    const v = hslHueToOklchHueRaw(h, s, l);
    table[h] = v === null ? Number.NaN : v;
  }

  if (forwardCache.size >= CACHE_LIMIT) {
    const oldest = forwardCache.keys().next().value;
    if (oldest !== undefined) forwardCache.delete(oldest);
  }
  forwardCache.set(key, table);
  return table;
}

/** Vacía la memoización. Sólo lo necesitan los tests. */
export const clearHueCache = (): void => forwardCache.clear();

/**
 * Tono HSL cuyo equivalente OKLCH es `targetH`, o null.
 *
 * La relación no es inyectiva, así que primero se reconoce si el tono actual
 * ya representa al objetivo — eso hace exacto el recorrido de ida y vuelta —
 * y sólo si no, se busca el más cercano desempatando por cercanía a `preferH`.
 *
 * `preferH` desempata en el sentido de "mantener el dial continuo": cerca del
 * azul el HSL avanza a saltos, y sin desempate el dial daría saltos gratis en
 * la dirección contraria.
 */
export function oklchHueToHslHue(
  targetH: number,
  s: number,
  l: number,
  preferH: number | null = null,
): number | null {
  const table = forwardTable(s, l);
  if (table === null) return null;

  const wanted = roundHue(targetH);

  // El tono actual ya es el que se pidió: se devuelve normalizado a [0,360).
  // Normalizar importa: el slider llega hasta 360 y `hsl(360, …)` produce el
  // mismo color que `hsl(0, …)` pero otra cadena, que es exactamente la clase
  // de contradicción que este tool no puede permitirse.
  if (preferH !== null) {
    const current = table[roundHue(preferH)];
    if (
      current !== undefined &&
      !Number.isNaN(current) &&
      roundHue(current) === wanted
    ) {
      return roundHue(preferH);
    }
  }

  let bestH = -1;
  let bestD = Infinity;
  let tieH = -1;
  let tieD = Infinity;

  for (let h = 0; h < 360; h++) {
    const cur = table[h];
    if (cur === undefined || Number.isNaN(cur)) continue;
    const d = circularDistance(cur, targetH);
    if (d < bestD - 1e-12) {
      bestD = d;
      bestH = h;
      tieH = h;
      tieD = preferH === null ? 0 : circularDistance(h, preferH);
    } else if (d <= bestD + 1e-12 && preferH !== null) {
      const pd = circularDistance(h, preferH);
      if (pd < tieD) {
        tieH = h;
        tieD = pd;
      }
    }
  }

  if (bestH < 0) return null;
  return tieH < 0 ? bestH : tieH;
}

/**
 * Los tonos OKLCH de los primarios HSL (0, 60, … 360) a la saturación y luz
 * pedidas. Alimenta los sectores del anillo interior, que se ven deformados a
 * propósito: esa deformación ES el segundo anillo.
 */
export function primaryOklchHues(s = 100, l = 50): (number | null)[] {
  const table = forwardTable(s, l);
  if (table === null) return new Array(7).fill(null);
  const out: (number | null)[] = [];
  for (let h = 0; h <= 360; h += 60) {
    // La tabla tiene 360 entradas: el tono 360 es el mismo color que el 0 y se
    // resuelve por módulo en vez de salirse del rango.
    const v = table[h % 360];
    out.push(v === undefined || Number.isNaN(v) ? null : v);
  }
  return out;
}
