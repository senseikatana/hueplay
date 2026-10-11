// Tipos compartidos por toda la matemática de color.
//
// Convención: los canales sRGB viven en [0,1]. HSL usa porcentajes 0..100 en s y
// l. OKLCH usa L en [0,1], croma absoluta (no el porcentaje de CSS) y tono en
// grados.

/** Color sRGB con alfa. Tras parsear, r/g/b están en [0,1] y a es 1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** HSL con s y l en porcentaje (0..100) y h en grados [0,360). */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** OKLCH con l en [0,1], c como croma ABSOLUTA (no porcentaje) y h en grados. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Triple sRGB lineal. Puede salirse de [0,1]: eso es justamente el gamut check. */
export type LinearRgb = readonly [number, number, number];

/**
 * CMYK con c, m, y, k en [0,1].
 *
 * NO es un espacio colorimétrico: es la cantidad de tinta de cada cartucho, y
 * dos impresoras distintas con la misma tupla dan colores distintos. Ver
 * `convert.ts` para por qué la conversión de acá es ingenua.
 */
export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}
