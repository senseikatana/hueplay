// Pruebas del router del edge. Ejecutar: bun run tests/bench-worker.ts
import worker from "../worker";

const ASSETS = async (req: Request): Promise<Response> => {
  const u = new URL(req.url);
  return new Response(`ASSETS-SAW path=${u.pathname}`, { status: 200 });
};

const env = { ASSETS: { fetch: ASSETS } } as never;

async function hit(rawUrl: string, method = "GET", host?: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    console.log(`${rawUrl.padEnd(58)} -> UNPARSEABLE`);
    return;
  }
  if (host) url.hostname = host;
  const req = new Request(url, { method });
  const res = await worker.fetch(req, env);
  const loc = res.headers.get("location");
  const body = res.headers.get("content-type")?.includes("text/plain")
    ? await res.text()
    : "";
  const via = body.startsWith("ASSETS-SAW") ? `  ${body}` : `  ${JSON.stringify(body)}`;
  console.log(
    `${(method + " " + rawUrl).padEnd(62)} -> ${res.status} ${loc ? "Loc=" + loc : ""}${via}`,
  );
}

console.log("=== 1. PATH TRAVERSAL: variantes percent-encoded ===");
const traversals = [
  "/hueplay/../etc/passwd",
  "/hueplay/%2e%2e/%2e%2e/etc/passwd",
  "/hueplay/%2E%2E%2F%2E%2E%2Fetc/passwd",
  "/hueplay/..%2f..%2fetc/passwd",
  "/hueplay/%252e%252e%252fetc/passwd",
  "/hueplay/....//....//etc/passwd",
  "/hueplay/..;/..;/etc/passwd",
  "/hueplay/.%2e/.%2e/etc/passwd",
  "/hueplay/%2e%2e%5c%2e%2e%5cetc/passwd",
  "/hueplay/..\\..\\etc/passwd",
  "/hueplay/%00",
  "/hueplay/a%00b",
  "/hueplay/%zz",
  "/hueplay/%2fetc/passwd",
  "/hueplay//evil.com/",
  "/hueplay/\\\\evil.com/",
  "/hueplay/\thttps://evil.com/",
];
for (const p of traversals) await hit(`https://senseikatana.com${p}`);

console.log("\n=== 2. HOST allow-list / open redirect ===");
for (const h of [
  "senseikatana.com",
  "www.senseikatana.com",
  "SENSEIKATANA.COM",
  "senseikatana.com.",
  "senseikatana.com.evil.com",
  "evil.senseikatana.com",
  "evil.com",
  "localhost",
  "127.0.0.1",
  "::1",
  "evil.workers.dev",
  "hueplay.workers.dev",
  "x.workers.dev.attacker.com",
  "attacker.com",
  "localhost.evil.com",
  "127.0.0.1.evil.com",
]) {
  await hit(`https://${h}/hueplay`, "GET", h);
}

console.log("\n=== 3. Redirect helper: status + cuerpo + headers ===");
for (const [path, expect] of [
  ["/hueplay", 301],
  ["/", 302],
] as [string, number][]) {
  await hit(`https://senseikatana.com${path}`);
  console.log(`   ^ esperado ${expect}`);
}

console.log("\n=== 4. METODOS ===");
for (const m of [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
  "TRACE",
  "PATCH",
  "PROPFIND",
]) {
  await hit("https://senseikatana.com/hueplay/", m);
}

console.log("\n=== 5. Envoltura del error de env.ASSETS (binding que lanza) ===");
{
  const envThrow = {
    ASSETS: {
      fetch: () => {
        throw new Error("secret internal detail: db=postgres://u:p@h/db");
      },
    },
  } as never;
  const res = await worker.fetch(
    new Request("https://senseikatana.com/hueplay/"),
    envThrow,
  );
  console.log(`ASSETS lanza -> ${res.status} body=${JSON.stringify(await res.text())}`);
}
{
  const envRej = {
    ASSETS: { fetch: () => Promise.reject(new Error("boom")) },
  } as never;
  const res = await worker.fetch(
    new Request("https://senseikatana.com/hueplay/"),
    envRej,
  );
  console.log(
    `ASSETS rechaza -> ${res.status} body=${JSON.stringify(await res.text())}`,
  );
}

console.log("\n=== 6. Headers en CADA respuesta ===");
for (const p of ["/", "/hueplay", "/hueplay/", "/nope", "/hueplay/nope.js"]) {
  await hit(`https://senseikatana.com${p}`);
}
{
  const envHdr = {
    ASSETS: {
      fetch: async () =>
        new Response("x", { status: 404, headers: { "content-type": "text/html" } }),
    },
  } as never;
  const res = await worker.fetch(
    new Request("https://senseikatana.com/hueplay/missing.html"),
    envHdr,
  );
  console.log(
    `404 de ASSETS -> ${res.status}, HSTS=${res.headers.get("strict-transport-security")}`,
  );
}

console.log("\n=== 7. Headers del redirect() (301 vs 302) ===");
{
  const r301 = await worker.fetch(new Request("https://senseikatana.com/hueplay"), env);
  const r302 = await worker.fetch(new Request("https://senseikatana.com/"), env);
  for (const [n, r] of [
    ["301", r301],
    ["302", r302],
  ] as const) {
    console.log(
      `${n}: status=${r.status} loc=${r.headers.get("location")} HSTS=${r.headers.get("strict-transport-security")} CSP=${r.headers.get("content-security-policy")} CC=${r.headers.get("cache-control")}`,
    );
  }
}

console.log("\n=== 8. Smuggling: CRLF y headers en la ruta ===");
for (const p of [
  "/hueplay/%0d%0aX-Injected:%201",
  "/hueplay/foo%0d%0a%0d%0a<script>",
  "/hueplay/a?b=%0d%0aSet-Cookie:%20x=1",
]) {
  await hit(`https://senseikatana.com${p}`);
}
