import { describe, expect, test } from "bun:test";
import worker from "../worker";

/**
 * El worker es una función async con un binding. Un stub alcanza para ejercitar
 * el router entero sin levantar workerd.
 *
 * Estos tests existen porque el worker NO tenía ninguno, y por eso el bug de
 * "las redirecciones no llevan headers de seguridad" sobrevivió tanto tiempo.
 */

interface FetchArgs {
  request: Request;
  env: { ASSETS: { fetch: (req: Request) => Promise<Response> } };
}

const ASSET_BODY = "<!doctype html><title>ok</title>";

/** Stub que responde 200 para lo que existe y 404 para el resto. */
const makeEnv = (overrides?: Partial<Record<string, string>>) => {
  const seen: Request[] = [];
  return {
    seen,
    env: {
      ASSETS: {
        fetch: async (req: Request) => {
          seen.push(req);
          const path = new URL(req.url).pathname;
          if (path === "/nope") return new Response("Not found", { status: 404 });
          const body = overrides?.[path] ?? ASSET_BODY;
          return new Response(body, {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        },
      },
    },
  };
};

const call = (
  url: string,
  init?: RequestInit,
  env?: ReturnType<typeof makeEnv>["env"],
) =>
  worker.fetch(new Request(url, init), {
    ASSETS: env?.ASSETS ?? makeEnv().env.ASSETS,
  } as FetchArgs["env"]) as Promise<Response>;

const PRODUCTION = "https://senseikatana.com";

describe("métodos", () => {
  test("sólo GET y HEAD; el resto recibe 405 con Allow", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const res = await call(`${PRODUCTION}/hueplay/`, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD");
    }
  });

  test("HEAD está permitido", async () => {
    const res = await call(`${PRODUCTION}/hueplay/`, { method: "HEAD" });
    expect(res.status).toBe(200);
  });
});

/** Todo header que la herramienta promete enviar en cada respuesta. */
const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "strict-transport-security",
];

/**
 * La promesa del README es "headers de seguridad en TODA respuesta, incluidas
 * 404 y 405". Esta es la aserción que la sostiene, y la que faltaba cuando las
 * redirecciones los perdían.
 */
const assertSecure = (res: Response, where: string): void => {
  for (const h of REQUIRED_HEADERS) {
    expect(res.headers.get(h), `${where} debe enviar ${h}`).not.toBeNull();
  }
};

describe("headers de seguridad", () => {
  test("los assets llevan CSP y HSTS", async () => {
    const res = await call(`${PRODUCTION}/hueplay/`);
    expect(res.status).toBe(200);
    assertSecure(res, "asset");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  test("LAS REDIRECCIONES TAMBIÉN llevan headers (el bug que había)", async () => {
    // `Response.redirect()` devuelve una respuesta sin headers. La primera
    // visita por http:// nunca recibía HSTS y quedaba fuera del pin.
    for (const [path, status] of [
      ["/", 302],
      ["/hueplay", 301],
    ] as const) {
      const res = await call(`${PRODUCTION}${path}`);
      expect(res.status).toBe(status);
      expect(res.headers.get("location")).toBe(`${PRODUCTION}/hueplay/`);
      assertSecure(res, `redirección ${path}`);
    }
  });

  test("los 404 también llevan headers", async () => {
    const res = await call(`${PRODUCTION}/hueplay/nope`);
    expect(res.status).toBe(404);
    assertSecure(res, "404 de asset");
  });

  test("un 404 de dominio desconocido lleva headers", async () => {
    const res = await call(`${PRODUCTION}/otra-cosa`);
    expect(res.status).toBe(404);
    assertSecure(res, "404 de ruta");
  });

  test("el throw del binding no se escapa sin headers", async () => {
    const env = {
      ASSETS: {
        fetch: async () => {
          throw new Error("boom");
        },
      },
    };
    const res = await call(`${PRODUCTION}/hueplay/`, undefined, env);
    expect(res.status).toBe(500);
    assertSecure(res, "500");
  });
});

describe("montaje de rutas", () => {
  test("quita el prefijo /hueplay antes de pedir el asset", async () => {
    const { env, seen } = makeEnv();
    await call(`${PRODUCTION}/hueplay/`, undefined, env);
    expect(new URL(seen[0]!.url).pathname).toBe("/");
  });

  test("reenvía la query string", async () => {
    const { env, seen } = makeEnv();
    await call(`${PRODUCTION}/hueplay/?hslHue=120&hslSat=80`, undefined, env);
    expect(seen[0]!.url).toContain("hslHue=120");
    expect(seen[0]!.url).toContain("hslSat=80");
  });

  test("sirve la subpágina de historia", async () => {
    const { env, seen } = makeEnv({
      "/historia/": "<!doctype html><title>historia</title>",
    });
    const res = await call(`${PRODUCTION}/hueplay/historia/`, undefined, env);
    expect(res.status).toBe(200);
    expect(new URL(seen[0]!.url).pathname).toBe("/historia/");
  });

  test("no hay fallback de SPA: una ruta desconocida da 404 real", async () => {
    const res = await call(`${PRODUCTION}/hueplay/nope`);
    expect(res.status).toBe(404);
  });
});

describe("traversal", () => {
  test("rechaza .. y sus variantes percent-encoded", async () => {
    const attempts = [
      "/hueplay/../../etc/passwd",
      "/hueplay/%2e%2e/%2e%2e/etc/passwd",
      "/hueplay/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd",
      "/hueplay/a/../../../etc/passwd",
    ];
    for (const p of attempts) {
      const res = await call(`${PRODUCTION}${p}`);
      expect(res.status, `debería rechazar ${p}`).toBe(404);
    }
  });

  test("rechaza percent-encoding inválido sin reventar", async () => {
    const res = await call(`${PRODUCTION}/hueplay/%E0%A4%A`);
    expect(res.status).toBe(404);
    assertSecure(res, "percent inválido");
  });

  test("no puede escapar a otro host por //", async () => {
    const { env, seen } = makeEnv();
    await call(`${PRODUCTION}/hueplay//evil.example.com/x`, undefined, env);
    expect(new URL(seen[0]!.url).host).toBe("senseikatana.com");
  });
});

describe("origen de las redirecciones", () => {
  test("un host desconocido NO se refleja en Location", async () => {
    const res = await call("https://evil.example.com/");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  test("www es un host permitido", async () => {
    const res = await call("https://www.senseikatana.com/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.senseikatana.com/hueplay/");
  });

  test("localhost se respeta para el dev server", async () => {
    const res = await call("http://localhost:8787/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:8787/hueplay/");
  });

  test("los previews *.workers.dev funcionan (antes daban 404 en la raíz)", async () => {
    const res = await call("https://hueplay.alice.workers.dev/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://hueplay.alice.workers.dev/hueplay/",
    );
  });
});

describe("CSP", () => {
  test("cubre frame-ancestors, base-uri y form-action", async () => {
    const res = await call(`${PRODUCTION}/hueplay/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  test("NO declara script-src a propósito (rompería la challenge de Cloudflare)", async () => {
    const res = await call(`${PRODUCTION}/hueplay/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).not.toContain("script-src");
    expect(csp).not.toContain("default-src");
  });
});
