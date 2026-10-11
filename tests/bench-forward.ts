// Muestra la RUTA EXACTA que el worker reenvia a env.ASSETS, y si puede
// escapar del directorio de assets.
import worker from "../worker";

// Mock que se comporta como el binding: normaliza y resuelve bajo la raiz.
const ASSETS_ROOT = "/home/senseikatana/Proyectos/hueplay/dist";
let lastForwarded = "";

const ASSETS = {
  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    lastForwarded = u.pathname + u.search;
    // Simula la normalizacion del binding: aplica WHATWG path normalization
    // (resuelve "." y "..") sobre la ruta ya decodificada.
    const afterFirstDecode = decodeURIComponent(u.pathname);
    let norm = afterFirstDecode;
    const segs: string[] = [];
    for (const s of norm.split("/")) {
      if (s === "" || s === ".") continue;
      if (s === "..") segs.pop();
      else segs.push(s);
    }
    const resolved = "/" + segs.join("/");
    // El binding sirve SOLO bajo la raiz: si resuelve fuera, no existe.
    const escapes = resolved.startsWith("/..") || resolved.includes("/../");
    return new Response(
      `FORWARDED=${u.pathname}${u.search} | postDecode1=${afterFirstDecode} | resolved=${resolved} | escapesRoot=${escapes}`,
      { status: 200, headers: { "content-type": "text/plain" } },
    );
  },
};

const env = { ASSETS } as never;

const cases = [
  "/hueplay/../etc/passwd",
  "/hueplay/%2e%2e/%2e%2e/etc/passwd",
  "/hueplay/%252e%252e%252f%252e%252e%252fetc/passwd",
  "/hueplay/%252e%252e%252findex.html",
  "/hueplay/a/%252e%252e/%252e%252e/%252e%252e/etc/passwd",
  "/hueplay/%2e%2e%252fetc/passwd",
  "/hueplay/%2525252e%2525252e%2525252f",
  "/hueplay/%c0%ae%c0%ae%c0%afetc/passwd",
  "/hueplay/..%c0%afetc/passwd",
  "/hueplay/..%ef%bc%8fetc/passwd",
  "/hueplay/index.html",
];

console.log("=== Rutas con encoding multiple / UTF-8 sobreexpresado ===");
for (const p of cases) {
  const res = await worker.fetch(new Request(`https://senseikatana.com${p}`), env);
  console.log(`\n${p}`);
  console.log(`  ${res.status} ${await res.text()}`);
}

console.log("\n=== Triple encoding: el filtro .. no lo ve ===");
const triple = "%2525252e%2525252e%2525252f";
await worker.fetch(
  new Request(`https://senseikatana.com/hueplay/${triple}etc/passwd`),
  env,
);
console.log(lastForwarded);

console.log("\n=== ¿El worker puede pedir un archivo de FUERA de dist? ===");
console.log("ASSETS_ROOT =", ASSETS_ROOT);
console.log(
  "Lo unico que el worker controla es la ruta; el binding acota al directorio.",
);

console.log("\n=== Rutas que SI resuelven dentro de dist (existencia real) ===");
for (const f of ["/index.html", "/preview.png", "/historia/", "/_astro/index.js"]) {
  const exists = await Bun.file(`${ASSETS_ROOT}${f}`).exists();
  console.log(`  ${f.padEnd(22)} en dist: ${exists}`);
}
