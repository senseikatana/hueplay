// Barrido de escalado: si el costo es lineal, 2x entrada => ~2x tiempo.
// Si fuera cuadrático (backtracking anidado), 2x entrada => ~4x tiempo.
import { parseCssColor, parseHsl, parseRgb } from "../src/lib/color/parse";

const ms = (t0: number) => performance.now() - t0;

function sweep(
  label: string,
  make: (n: number) => string,
  run: (s: string) => unknown,
) {
  console.log(`\n--- ${label} ---`);
  let prevT = 0;
  let prevN = 0;
  for (const n of [100_000, 200_000, 400_000, 800_000, 1_600_000, 3_200_000]) {
    const s = make(n);
    run(s); // warm
    const t0 = performance.now();
    run(s);
    const t = ms(t0);
    const growth =
      prevN === 0
        ? "-"
        : `${(t / prevT).toFixed(2)}x tiempo para ${(n / prevN).toFixed(0)}x entrada`;
    console.log(
      `${String(n).padStart(9)} chars ${t.toFixed(2).padStart(9)} ms   ${growth}`,
    );
    prevT = t;
    prevN = n;
  }
}

sweep(
  "matchFunc: 'a'*n sin parentesis (via parseRgb)",
  (n) => "a".repeat(n),
  (s) => parseRgb(s),
);

sweep(
  "NUMBER_RE: '9'*n + 'x' en rgb()",
  (n) => "rgb(" + "9".repeat(n) + "x 0 0)",
  (s) => parseRgb(s),
);

sweep(
  "readAngle: '9'*n + 'x' en hsl()",
  (n) => "hsl(" + "9".repeat(n) + "x 0% 50%)",
  (s) => parseHsl(s),
);

sweep(
  "splitArgs: n tokens en rgb()",
  (n) => "rgb(" + "1 ".repeat(n).trim() + " 0 0)",
  (s) => parseRgb(s),
);

sweep(
  "parseCssColor completo: '1 '*n dentro de rgb()",
  (n) => "rgb(" + "1 ".repeat(n).trim(),
  (s) => parseCssColor(s),
);
