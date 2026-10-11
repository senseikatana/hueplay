import { describe, expect, test } from "bun:test";
import {
  CHROMA_UNIT,
  clearHueCache,
  formatHex,
  formatHsl,
  formatOklch,
  hslHueToOklchHue,
  hslToRgb,
  inSrgbGamut,
  maxSrgbChroma,
  oklchHueToHslHue,
  oklchToRgb,
  parseCssColor,
  parseOkLchTriple,
  perceptualGrey,
  primaryOklchHues,
  rgbToHsl,
  rgbToOklabLightness,
  rgbToOklch,
} from "../src/lib/color";

const circ = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe("referencias publicadas de OKLab/OKLCH", () => {
  test("rojo #ff0000", () => {
    const o = rgbToOklch(1, 0, 0);
    expect(o.l).toBeCloseTo(0.6279554, 4);
    expect(o.c).toBeCloseTo(0.2576833, 4);
    expect(o.h).toBeCloseTo(29.2338, 2);
  });

  test("primarios HSL (S=100, L=50) dan los tonos OKLCH esperados", () => {
    const expected = [29.23, 109.77, 142.5, 194.77, 264.05, 328.36];
    const prims = primaryOklchHues(100, 50).slice(0, 6);
    for (const [i, v] of expected.entries()) {
      expect(prims[i]).toBeCloseTo(v, 1);
    }
  });

  test("blanco y negro", () => {
    expect(rgbToOklch(1, 1, 1).l).toBeCloseTo(1, 6);
    expect(rgbToOklch(0, 0, 0).l).toBeCloseTo(0, 6);
  });

  test("el gris no inventa un tono: croma cero implica tono cero", () => {
    // El bug: atan2(~1e-8, ~1e-8) devolvía 89.88° para #808080, así que el
    // chip decía "0% de croma y un tono concreto". Una contradicción visible.
    expect(formatOklch(0.5, 0.5, 0.5)).toBe("oklch(59.82% 0% 0)");
    expect(formatOklch(0.75, 0.75, 0.75)).toContain("% 0% 0)");
    expect(formatOklch(0, 0, 0)).toBe("oklch(0% 0% 0)");
    expect(formatOklch(1, 1, 1)).toBe("oklch(100% 0% 0)");
  });

  test("un color con croma real sí conserva su tono", () => {
    expect(formatOklch(1, 0, 0)).toBe("oklch(62.8% 64.42% 29.23)");
  });
});

describe("round-trip de tono HSL <-> OKLCH", () => {
  test("HSL -> OKLCH redondeado -> HSL devuelve el original (0 fallos)", () => {
    clearHueCache();
    let n = 0;
    for (let s = 10; s <= 100; s += 10) {
      for (let l = 10; l <= 90; l += 10) {
        for (let h = 0; h < 360; h++) {
          const f = hslHueToOklchHue(h, s, l);
          if (f === null) continue;
          n++;
          expect(oklchHueToHslHue(Math.round(f), s, l, h)).toBe(h);
        }
      }
    }
    expect(n).toBeGreaterThan(30000);
  });

  test("la equivalencia depende de S y L, no sólo del ángulo", () => {
    const a = hslHueToOklchHue(240, 100, 50) as number;
    const b = hslHueToOklchHue(240, 30, 40) as number;
    expect(Math.abs(a - b)).toBeGreaterThan(5);
  });

  test("el arrastre del slider OKLCH no da saltos gratuitos", () => {
    let prev = oklchHueToHslHue(0, 65, 50, 0) ?? 0;
    let jumps = 0;
    for (let t = 1; t <= 360; t++) {
      const cur = oklchHueToHslHue(t, 65, 50, prev);
      if (cur === null) continue;
      if (circ(cur, prev) > 3) jumps++;
      prev = cur;
    }
    expect(jumps).toBeLessThan(30);
  });

  test("el tono devuelto nunca es 360 (el panel y el chip deben coincidir)", () => {
    // El slider llega hasta 360 y hsl(360,…) es el mismo color que hsl(0,…)
    // pero otra cadena. Antes devolvía 360 verbatim.
    clearHueCache();
    expect(oklchHueToHslHue(29.23, 100, 50, 360)).toBe(0);
    for (let h = 0; h < 360; h++) {
      const back = oklchHueToHslHue(
        hslHueToOklchHue(h, 100, 50) as number,
        100,
        50,
        360,
      );
      if (back !== null) expect(back).toBeLessThan(360);
    }
  });

  test("sin preferH desempata igual y devuelve algo válido", () => {
    clearHueCache();
    for (let t = 0; t < 360; t += 17) {
      const back = oklchHueToHslHue(t, 80, 45, null);
      expect(back).not.toBeNull();
      expect(back as number).toBeGreaterThanOrEqual(0);
      expect(back as number).toBeLessThan(360);
    }
  });
});

describe("round-trip de color RGB <-> OKLCH", () => {
  test("cada canal vuelve al valor original", () => {
    let worst = 0;
    for (let h = 0; h < 360; h += 5) {
      const rgb = hslToRgb(h, 60, 50);
      const o = rgbToOklch(rgb[0], rgb[1], rgb[2]);
      const back = oklchToRgb(o.l, o.c, o.h);
      for (let i = 0; i < 3; i++) {
        worst = Math.max(worst, Math.abs(back[i]! - rgb[i]!));
      }
    }
    expect(worst).toBeLessThan(1e-3);
  });

  test("la croma fuera de gamut se reduce, no se desborda", () => {
    const out = oklchToRgb(0.5, 0.4, 30);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(out[0]).toBeGreaterThan(out[1]);
  });

  test("maxSrgbChroma marca justo el borde del gamut", () => {
    for (const h of [29, 110, 142, 195, 264, 328]) {
      const l = 0.5;
      const c = maxSrgbChroma(l, 0.4, h);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(0.4);
      // Justo dentro: en gamut. Justo fuera: fuera de gamut.
      expect(inSrgbGamut(l, c * 0.97, h)).toBe(true);
      expect(inSrgbGamut(l, c * 1.03 + 0.01, h)).toBe(false);
    }
  });

  test("perceptualGrey devuelve el gris con la luminosidad pedida", () => {
    for (const l of [0.2, 0.5, 0.8]) {
      const g = perceptualGrey(l);
      expect(rgbToOklabLightness(g.r, g.g, g.b)).toBeCloseTo(l, 3);
      expect(g.r).toBeCloseTo(g.b, 5);
    }
  });
});

describe("normalización de tono HSL", () => {
  test("hslToRgb envuelve h fuera de rango", () => {
    const base = hslToRgb(30, 100, 50);
    for (const h of [-330, 30, 390, 750]) {
      const rgb = hslToRgb(h, 100, 50);
      for (let i = 0; i < 3; i++) {
        expect(rgb[i]!).toBeCloseTo(base[i]!, 9);
      }
    }
  });

  test("rgbToHsl devuelve h en [0,360) incluso con h negativo", () => {
    for (let i = 0; i < 2000; i++) {
      const rgb = hslToRgb(i * 0.7, 80, 55);
      const { h } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  test("hue 360 y hue 0 son el mismo color", () => {
    for (let i = 0; i < 3; i++) {
      expect(hslToRgb(360, 70, 40)[i]!).toBeCloseTo(hslToRgb(0, 70, 40)[i]!, 9);
    }
  });

  test("rgbToHsl de un gris no divide por cero", () => {
    for (const v of [0, 0.5, 1]) {
      const o = rgbToHsl(v, v, v);
      expect(o.s).toBe(0);
      expect(o.h).toBe(0);
      expect(o.l).toBeCloseTo(v * 100, 9);
    }
  });
});

describe("casos degenerados", () => {
  test("acromáticos y luz extrema devuelven null", () => {
    expect(hslHueToOklchHue(0, 0, 50)).toBeNull();
    expect(hslHueToOklchHue(0, 100, 0)).toBeNull();
    expect(hslHueToOklchHue(0, 100, 100)).toBeNull();
    expect(oklchHueToHslHue(30, 0, 50)).toBeNull();
    expect(oklchHueToHslHue(30, 100, 0)).toBeNull();
  });

  test("si el tono actual ya coincide no se mueve", () => {
    expect(oklchHueToHslHue(264, 100, 50, 237)).toBe(237);
  });

  test("primaryOklchHues acepta otros parámetros, no sólo (100,50)", () => {
    clearHueCache();
    const suave = primaryOklchHues(60, 40);
    const full = primaryOklchHues(100, 50);
    expect(suave).toHaveLength(7);
    expect(full).toHaveLength(7);
    // Menos saturación, luz distinta -> los tonos se desplazan.
    const diffs = full
      .slice(0, 6)
      .map((v, i) => Math.abs((v as number) - (suave[i] as number)))
      .filter((d) => d > 0.5);
    expect(diffs.length).toBeGreaterThan(0);
  });

  test("primaryOklchHues con parámetros sin tono devuelve todo null", () => {
    clearHueCache();
    expect(primaryOklchHues(0, 50).every((v) => v === null)).toBe(true);
  });
});

describe("aviso de gamut", () => {
  test("detecta triples OKLCH que no caben en sRGB", () => {
    expect(inSrgbGamut(0.5, 0.4, 30)).toBe(false); // croma 100%
    expect(inSrgbGamut(0.5, 0.26, 30)).toBe(false); // aún por encima del techo
    expect(inSrgbGamut(0.627955, 0.257683, 29.2338)).toBe(true); // el rojo real
    expect(inSrgbGamut(0.97, 0.02, 90)).toBe(true); // casi blanco
  });

  test("la insignia es estricta: no dice 'in gamut' si el navegador recorta", () => {
    // El predicado de la insignia NO puede reusar la tolerancia generosa de la
    // búsqueda de croma: 539.226 combinaciones del grid encendían la insignia
    // apagada mientras el navegador recortaba de verdad.
    let falsePositives = 0;
    let total = 0;
    for (let l = 0.05; l < 1; l += 0.05) {
      for (let c = 0.02; c <= 1; c += 0.02) {
        for (let h = 0; h < 360; h += 3) {
          total++;
          const L = l;
          const C = (c / 100) * CHROMA_UNIT;
          if (!inSrgbGamut(L, C, h)) continue;
          // Si dice in gamut, tiene que caber de verdad en [0,1].
          const [r, g, b] = oklchToRgb(L, C, h);
          const reallyInGamut =
            r >= -1e-6 &&
            r <= 1 + 1e-6 &&
            g >= -1e-6 &&
            g <= 1 + 1e-6 &&
            b >= -1e-6 &&
            b <= 1 + 1e-6;
          if (!reallyInGamut) falsePositives++;
        }
      }
    }
    expect(total).toBeGreaterThan(10000);
    expect(falsePositives).toBe(0);
  });

  test("los seis primarios HSL están dentro del gamut", () => {
    for (let h = 0; h <= 360; h += 60) {
      const [r, g, b] = hslToRgb(h, 100, 50);
      const o = rgbToOklch(r, g, b);
      expect(inSrgbGamut(o.l, o.c, o.h)).toBe(true);
    }
  });
});

describe("parseo de colores CSS", () => {
  const hexOf = (s: string): string | null => {
    const p = parseCssColor(s);
    return p === null ? null : formatHex(p.r, p.g, p.b);
  };

  test("hex con y sin #, 3/4/6/8 dígitos, mayúsculas", () => {
    expect(hexOf("#f00")).toBe("#ff0000");
    expect(hexOf("#FF0000")).toBe("#ff0000");
    expect(hexOf("ff0000")).toBe("#ff0000");
    expect(hexOf("#0f08")).toBe("#00ff00");
    expect(hexOf("#123456")).toBe("#123456");
    expect(hexOf("#12345")).toBeNull();
    expect(hexOf("#zzzzzz")).toBeNull();
    expect(hexOf("")).toBeNull();
  });

  test("rgb en sintaxis moderna y legada", () => {
    expect(hexOf("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(hexOf("rgb(255 0 0)")).toBe("#ff0000");
    expect(hexOf("rgba(255,0,0,0.5)")).toBe("#ff0000");
    expect(hexOf("rgb(255 0 0 / .5)")).toBe("#ff0000");
    expect(hexOf("rgb(100% 0% 0%)")).toBe("#ff0000");
    expect(hexOf("rgb(a, b, c)")).toBeNull();
  });

  test("hsl en sintaxis moderna y legada", () => {
    expect(hexOf("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(hexOf("hsl(0 100% 50%)")).toBe("#ff0000");
    expect(hexOf("hsl(49, 100%, 50%)")).toBe("#ffd000");
    expect(hexOf("hsl(120 100 50)")).toBe("#00ff00");
    expect(hexOf("hsl(240deg 100% 50%)")).toBe("#0000ff");
  });

  test("oklch acepta croma en % y en número", () => {
    const a = parseCssColor("oklch(62.8% 64.4% 29.2)");
    const b = parseCssColor("oklch(0.628 0.2576 29.23)");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(formatHex(a!.r, a!.g, a!.b)).toBe("#ff0001");
    expect(formatHex(b!.r, b!.g, b!.b)).toBe("#ff0000");
    // 64.4% de 0.4 = 0.2576: las dos notaciones son el mismo color
    expect(Math.abs(a!.r - b!.r)).toBeLessThan(0.01);
  });

  test("lch() ya no es una notación soportada (se retiró por ser D50/print)", () => {
    expect(parseCssColor("lch(54.29% 106.84 40.86)")).toBeNull();
    expect(parseCssColor("lch(54.3 106.8 40.9)")).toBeNull();
    expect(parseCssColor("lab(50% 20 30)")).toBeNull();
  });

  test("rechaza basura pegada a los números", () => {
    // parseFloat se comía "50zz%": un tool que rechaza lch() a propósito no
    // puede ser tolerante con la sintaxis del resto.
    expect(parseCssColor("hsl(0 50zz% 50%)")).toBeNull();
    expect(parseCssColor("oklch(62.8xx% 0.1 20)")).toBeNull();
    expect(parseCssColor("rgb(255zz 0 0)")).toBeNull();
    expect(parseCssColor("hsl(0 100 50)extra")).toBeNull();
  });

  test("parseOkLchTriple devuelve el triple escrito, sin recortar al gamut", () => {
    const t = parseOkLchTriple("oklch(50% 100% 30)");
    expect(t).toEqual({ l: 0.5, c: 0.4, h: 30 });
    expect(inSrgbGamut(t!.l, t!.c, t!.h)).toBe(false);
    const inGamut = parseOkLchTriple("oklch(62.8% 64.42% 29.23)");
    expect(inGamut!.h).toBeCloseTo(29.23, 2);
    expect(inSrgbGamut(inGamut!.l, inGamut!.c, inGamut!.h)).toBe(true);
    expect(parseOkLchTriple("hsl(0 100% 50%)")).toBeNull();
    expect(parseOkLchTriple("oklch(1 2)")).toBeNull();
  });

  test("entradas que no son colores devuelven null", () => {
    for (const bad of ["", "  ", "hola", "rgb()", "oklch(1 2)", "12345678901234"]) {
      expect(parseCssColor(bad)).toBeNull();
    }
  });

  test("demasiados argumentos no son un color", () => {
    expect(parseCssColor("rgb(255 0 0 0.5 9)")).toBeNull();
    expect(parseCssColor("hsl(0 100% 50% 0.5 9)")).toBeNull();
  });

  test("formatear y volver a parsear conserva el color", () => {
    const samples: [number, number, number][] = [
      [1, 0, 0],
      [0.5, 0.25, 0.75],
      [0, 1, 1],
      [0.13, 0.47, 0.9],
    ];
    for (const [r, g, b] of samples) {
      for (const s of [formatHex(r, g, b), formatHsl(r, g, b), formatOklch(r, g, b)]) {
        const p = parseCssColor(s);
        expect(p).not.toBeNull();
        expect(Math.abs(p!.r - r)).toBeLessThan(2 / 255);
        expect(Math.abs(p!.g - g)).toBeLessThan(2 / 255);
        expect(Math.abs(p!.b - b)).toBeLessThan(2 / 255);
      }
    }
  });

  test("los formatos salen con la sintaxis esperada", () => {
    expect(formatHex(1, 0, 0)).toBe("#ff0000");
    expect(formatHsl(1, 0, 0)).toBe("hsl(0, 100%, 50%)");
    expect(formatOklch(1, 0, 0)).toBe("oklch(62.8% 64.42% 29.23)");
  });

  // El caso de referencia de la verificación manual, sobre el hex EXACTO.
  test("#ffd000 se convierte exacto y sin redondear", () => {
    const p = parseCssColor("#ffd000")!;
    expect(formatOklch(p.r, p.g, p.b)).toBe("oklch(87.3% 44.65% 92.23)");
    expect(formatHsl(p.r, p.g, p.b)).toBe("hsl(49, 100%, 50%)");
    expect(formatHex(p.r, p.g, p.b)).toBe("#ffd000");
  });

  // El chip de la UI NO convierte el hex pegado: convierte el color que queda
  // EN PANTALLA, que es el del slider ya redondeado. Son dos colores a un
  // decimal de distancia en el tono (48.94 vs 49) y dan triples distintos.
  test("el chip convierte el color del slider, no el hex sin redondear", () => {
    const p = parseCssColor("#ffd000")!;
    const exact = rgbToHsl(p.r, p.g, p.b);
    // El tono real de #ffd000 NO es entero.
    expect(exact.h).toBeCloseTo(48.941, 3);

    // Lo que la UI muestra tras aplicar el color: los sliders ya redondeados.
    const onScreen = hslToRgb(
      Math.round(exact.h),
      Math.round(exact.s),
      Math.round(exact.l),
    );
    expect(formatOklch(onScreen[0], onScreen[1], onScreen[2])).toBe(
      "oklch(87.35% 44.68% 92.34)",
    );

    // Y el hex es indistinguible entre los dos, que es por lo que el chip #hex
    // nunca revela la diferencia.
    expect(formatHex(...onScreen)).toBe("#ffd000");
    expect(formatHex(p.r, p.g, p.b)).toBe("#ffd000");
  });
});
