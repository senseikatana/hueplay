// Benchmarks de ReDoS / DoS para el parser de color.
// No forma parte de `bun test`; se ejecuta a mano con:
//   bun run tests/bench-redos.ts
import {
  parseCssColor,
  parseOkLch,
  parseHsl,
  parseRgb,
  parseHex,
} from "../src/lib/color/parse";

const ms = (t0: number) => Number((performance.now() - t0).toFixed(3));

function bench(label: string, fn: () => unknown, iters = 1): void {
  fn(); // warm
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const dt = ms(t0) / iters;
  const flag = dt > 100 ? "  <== SLOW" : dt > 10 ? "  <-- notable" : "";
  console.log(`${label.padEnd(64)} ${String(dt).padStart(12)} ms${flag}`);
}

console.log("=== 1. BASELINE benigno ===");
bench("rgb(255 0 0) x10000", () => parseRgb("rgb(255 0 0)"), 10_000);
bench("hsl(49 100% 50%) x10000", () => parseHsl("hsl(49 100% 50%)"), 10_000);
bench(
  "oklch(62.8% 64.42% 29.23) x10000",
  () => parseOkLch("oklch(62.8% 64.42% 29.23)"),
  10_000,
);
bench("#ffd000 x10000", () => parseHex("#ffd000"), 10_000);

console.log("\n=== 2. matchFunc: /^([a-z]+)\\((.*)\\)$/is ===");
bench(
  "'a'*1e5 (sin parentesis) -> fallback a 1 linea",
  () => parseRgb("a".repeat(100_000)),
  1,
);
bench(
  "'a'*1e6 (sin parentesis) -> fallback a 1 linea",
  () => parseRgb("a".repeat(1_000_000)),
  1,
);
bench(
  "'a'*1e5 + '(' + 'b'*1e5  (no cierra)",
  () => parseRgb("a".repeat(100_000) + "(" + "b".repeat(100_000)),
  1,
);
bench(
  "'a'*1e6 + '(' + 'b'*1e6  (no cierra)",
  () => parseRgb("a".repeat(1_000_000) + "(" + "b".repeat(1_000_000)),
  1,
);
bench(
  "'rgb(' + '1 '*1e5  (falta ')')",
  () => parseRgb("rgb(" + "1 ".repeat(100_000)),
  1,
);
bench(
  "'rgb(' + '1 '*1e6  (falta ')')",
  () => parseRgb("rgb(" + "1 ".repeat(1_000_000)),
  1,
);
bench(
  "'rgb(' + '\\n'*1e6 + ')'",
  () => parseRgb("rgb(" + "\n".repeat(1_000_000) + ")"),
  1,
);
bench(
  "'rgb(' + 'x\\n'*5e5 + ')'",
  () => parseRgb("rgb(" + "x\n".repeat(500_000) + ")"),
  1,
);
bench(
  "'rgb(1 2 3)' + '\\n'*1e6 (ancla $ con flag s)",
  () => parseRgb("rgb(1 2 3)" + "\n".repeat(1_000_000)),
  1,
);

console.log(
  "\n=== 3. NUMBER_RE: /^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?$/ ===",
);
bench(
  "'9'*1e5 + 'x' (falla al final, backtrack de \\d+)",
  () => parseRgb("rgb(" + "9".repeat(100_000) + "x 0 0)"),
  1,
);
bench("'9'*1e6 + 'x'", () => parseRgb("rgb(" + "9".repeat(1_000_000) + "x 0 0)"), 1);
bench("'9'*1e7 + 'x'", () => parseRgb("rgb(" + "9".repeat(10_000_000) + "x 0 0)"), 1);
bench(
  "'1.'+ '9'*1e6 + 'e'  (exponente malformado)",
  () => parseRgb("rgb(1." + "9".repeat(1_000_000) + "e 0 0)"),
  1,
);
bench(
  "'.'+ '9'*1e6 + 'x'",
  () => parseRgb("rgb(." + "9".repeat(1_000_000) + "x 0 0)"),
  1,
);

console.log("\n=== 4. readAngle: /^(...)(deg|grad|rad|turn)?$/i ===");
bench(
  "hsl('9'*1e6 + 'x' 0% 50%)",
  () => parseHsl("hsl(" + "9".repeat(1_000_000) + "x 0% 50%)"),
  1,
);
bench(
  "hsl('9'*1e6 + 'd 0% 50%)  (unit parcial)",
  () => parseHsl("hsl(" + "9".repeat(1_000_000) + "d 0% 50%)"),
  1,
);

console.log("\n=== 5. splitArgs: replace(/\\//g).replace(/,/g).split(/\\s+/) ===");
const mkTokens = (n: number) => "1 ".repeat(n).trim();
bench("splitArgs con 100 tokens", () => parseRgb(`rgb(${mkTokens(100)} 0 0)`), 1);
bench("splitArgs con 100k tokens", () => parseRgb(`rgb(${mkTokens(100_000)} 0 0)`), 1);
bench("splitArgs con 1M tokens", () => parseRgb(`rgb(${mkTokens(1_000_000)} 0 0)`), 1);
bench("splitArgs con 5M tokens", () => parseRgb(`rgb(${mkTokens(5_000_000)} 0 0)`), 1);
bench("splitArgs 1M commas", () => parseRgb("rgb(1" + ",".repeat(1_000_000) + ")"), 1);
bench("splitArgs 1M slashes", () => parseRgb("rgb(1" + "/".repeat(1_000_000) + ")"), 1);
bench("splitArgs 1M tabs", () => parseRgb("rgb(1" + "\t".repeat(1_000_000) + ")"), 1);
bench(
  "splitArgs 1M solo espacios",
  () => parseRgb("rgb(" + " ".repeat(1_000_000) + ")"),
  1,
);

console.log("\n=== 6. parseHex: /^[0-9a-f]+$/i ===");
bench(
  "'f'*1e7 (hex valido, 10M digitos)",
  () => parseHex("#" + "f".repeat(10_000_000)),
  1,
);
bench(
  "'f'*1e7 + 'g' (invalido)",
  () => parseHex("#" + "f".repeat(10_000_000) + "g"),
  1,
);

console.log("\n=== 7. parseCssColor completo (todo el pipeline) ===");
bench("10MB de basura no parseable", () => parseCssColor("x".repeat(10_000_000)), 1);
bench(
  "10MB dentro de rgb() sin cerrar",
  () => parseCssColor("rgb(" + "1 ".repeat(5_000_000)),
  1,
);
bench(
  "10MB de digitos + basura en hsl()",
  () => parseCssColor("hsl(" + "9".repeat(10_000_000) + "x 0% 0%)"),
  1,
);

console.log("\n=== 8. Memoria del array de splitArgs ===");
for (const n of [1_000_000, 4_000_000]) {
  const inner = "1 ".repeat(n);
  const t0 = performance.now();
  const parts = inner
    .replace(/\//g, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  console.log(
    `${n} tokens -> ${parts.length} elementos, ${ms(t0)} ms, ~${((parts.length * 24) / 1e6).toFixed(1)} MB depunteros (string slicing)`,
  );
}
