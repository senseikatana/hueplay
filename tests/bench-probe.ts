// Sondas de correccion del parser: colisiones, smuggling entre sintaxis,
// rangos fuera de lo esperado.
import {
  parseCssColor,
  parseHex,
  parseHsl,
  parseOkLch,
  parseOkLchTriple,
  parseRgb,
  formatHex,
} from "../src/lib/color/parse";

const show = (v: unknown): string =>
  v === null
    ? "null"
    : typeof v === "object" && v !== null && "r" in v
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(v as Record<string, number>).map(([k, n]) => [
              k,
              Number.isFinite(n as number)
                ? Number((n as number).toFixed(4))
                : String(n),
            ]),
          ),
        )
      : JSON.stringify(v);

console.log("=== A. Colision con nombres de color CSS (bareHex de 3/4/6/8 chars) ===");
for (const s of [
  "red",
  "beef",
  "added",
  "beaded",
  "facade",
  "decade",
  "deface",
  "fad",
  "abc",
  "cab",
  "bad",
]) {
  const p = parseCssColor(s);
  console.log(
    `${s.padEnd(10)} -> ${show(p)}${p ? "   <= COLISION (nombre CSS no soportado)" : ""}`,
  );
}

console.log("\n=== B. Nombres CSS reales que NO colisionan (deben ser null) ===");
for (const s of ["blue", "cyan", "pink", "gold", "lime", "navy", "teal", "coral"]) {
  console.log(`${s.padEnd(10)} -> ${show(parseCssColor(s))}`);
}

console.log("\n=== C. Smuggling: separadores mezclados que CSS no acepta ===");
const smuggle = [
  "rgb(1,2 3)",
  "rgb(1 2,3)",
  "rgb(1 2 3/)",
  "rgb(1,2,3,4)",
  "rgb( 1 2 3 )",
  "hsl(0, 50% 50%)",
  "hsl(0 50%,50%)",
  "oklch(50% 0.15, 30)",
  "oklch(50%, 15%, 30)",
];
for (const s of smuggle) console.log(`${s.padEnd(22)} -> ${show(parseCssColor(s))}`);

console.log("\n=== D. Cruce de sintaxis: oklch() no debe aceptarse como otra ===");
for (const s of [
  "lch(50% 30 30)",
  "lab(50% 30 30)",
  "oklab(0.5 0.1 0.1)",
  "color(--x 0 0)",
]) {
  console.log(`${s.padEnd(24)} -> ${show(parseCssColor(s))}`);
}

console.log("\n=== E. Rango fuera de lo esperado (NaN / Infinity / negativo) ===");
const edge = [
  "rgb(1e999 0 0)",
  "rgb(-999 999999 0)",
  "hsl(1e999 50% 50%)",
  "hsl(0 1e999% 50%)",
  "oklch(1e999 0.1 30)",
  "oklch(0.5 1e999 30)",
  "oklch(0.5 0.1 1e999)",
  "oklch(-5 -5 -5)",
  "rgb(0/0 0/0 0/0)",
];
for (const s of edge) {
  const p = parseCssColor(s);
  console.log(`${s.padEnd(22)} -> ${show(p)}`);
}

console.log("\n=== F. Valores no finitos que ESCAPAN del triple OKLCH tipado ===");
for (const s of [
  "oklch(50% 0.15 30)",
  "oklch(1e5 0.15 30)",
  "oklch(-1 0.15 30)",
  "oklch(50% 1e5 30)",
  "oklch(50% 0.15 1e5)",
  "oklch(50% 0.15 -30)",
  "oklch(50% 0.15 1e5turn)",
]) {
  const t = parseOkLchTriple(s);
  const p = parseOkLch(s);
  console.log(
    `${s.padEnd(20)} triple=${show(t)}  hex=${p ? formatHex(p.r, p.g, p.b) : "-"}`,
  );
}

console.log("\n=== G. Canal alfa: leido pero descartado ===");
for (const s of [
  "#ff000080",
  "#ff000000",
  "rgb(255 0 0 / 0)",
  "rgba(255,0,0,0.1)",
  "hsl(0 100% 50% / 0)",
]) {
  const p = parseCssColor(s);
  console.log(
    `${s.padEnd(20)} -> ${show(p)}   hex=${p ? formatHex(p.r, p.g, p.b) : "-"}`,
  );
}

console.log("\n=== H. Salida de formatHex con entrada fuera de rango ===");
for (const [r, g, b] of [
  [-5, 300, 0],
  [NaN, 0.5, 0.5],
  [Infinity, -Infinity, 0.5],
  [1e308, 0, 0],
] as [number, number, number][]) {
  console.log(
    `formatHex(${r},${g},${b}) -> ${formatHex(r, g, b)}   formatHsl -> ${(() => {
      try {
        return require("../src/lib/color/parse").formatHsl(r, g, b);
      } catch {
        return "n/a";
      }
    })()}`,
  );
}

console.log("\n=== I. parseHex con longitudes no soportadas ===");
for (const s of [
  "#f",
  "#ff",
  "#fffff",
  "#fffffff",
  "#f0f0f0f0f",
  "##ff0000",
  "# ff0000",
]) {
  console.log(`${s.padEnd(14)} -> ${show(parseHex(s))}`);
}

console.log("\n=== J. Hue en grados rotos / wrapping ===");
for (const s of [
  "hsl(720 50% 50%)",
  "hsl(-90 50% 50%)",
  "oklch(50% 0.1 720)",
  "oklch(50% 0.1 -90)",
]) {
  console.log(`${s.padEnd(20)} -> ${show(parseCssColor(s))}`);
}

console.log("\n=== K. Entrada 10MB: se rechaza sin colgarse ni lanzar ===");
const huge = "rgb(" + "1 ".repeat(5_000_000);
const t0 = performance.now();
const r = parseCssColor(huge);
console.log(`10MB rgb() -> ${show(r)} en ${(performance.now() - t0).toFixed(1)} ms`);
