// Edge router: monta la app en /hueplay/* y aplica los headers de seguridad.
const BASE = "/hueplay";
const APP_HOSTS = new Set(["senseikatana.com", "www.senseikatana.com"]);

// frame-ancestors/base-uri/form-action no tocan la ejecución de scripts: así
// no entramos en conflicto con los scripts inline que inyecta la challenge
// platform de Cloudflare (JavaScript Detections) cuando hay un challenge activo.
//
// NO agregar `script-src`: rompería la challenge platform.
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

function withSecurity(headers) {
  const out = new Headers(headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) out.set(key, value);
  return out;
}

function plain(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: withSecurity({
      "content-type": "text/plain; charset=utf-8",
      ...extra,
    }),
  });
}

/**
 * Redirección CON headers de seguridad.
 *
 * `Response.redirect()` devuelve una respuesta pelada: sin CSP, sin HSTS. Eso
 * rompía la promesa de "headers en todas las respuestas", y el de HSTS es el que
 * más duele, porque una primera visita por `http://` nunca lo recibe y queda
 * fuera del pin de HSTS para siempre.
 */
function redirect(url, status) {
  const r = Response.redirect(url, status);
  const headers = withSecurity(r.headers);
  headers.set("Cache-Control", "no-cache");
  return new Response(r.body, { status, headers });
}

// Origen para las redirecciones. En local se respeta el del dev server; en
// producción se fija, para no reflejar un Host manipulado en la Location.
function redirectOrigin(url) {
  const host = url.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    // Los deploys de previsualización viven en *.workers.dev. Sin esto, la raíz
    // de un preview respondía 404 y no se podía probar el montaje /hueplay/.
    host.endsWith(".workers.dev")
  ) {
    return url.origin;
  }
  return APP_HOSTS.has(host) ? `https://${host}` : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Los assets son de solo lectura: no hay nada que escribir.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return plain(405, "Method not allowed", { Allow: "GET, HEAD" });
    }

    const origin = redirectOrigin(url);

    // /hueplay -> /hueplay/
    if (pathname === BASE) {
      if (!origin) return plain(404, "Not found");
      return redirect(`${origin}${BASE}/`, 301);
    }

    // Raíz del dominio: sirve la sección hueplay.
    if (pathname === "/") {
      if (!origin) return plain(404, "Not found");
      return redirect(`${origin}${BASE}/`, 302);
    }

    if (!pathname.startsWith(`${BASE}/`)) {
      return plain(404, "Not found");
    }

    // Se reconstruye la ruta en vez de recortarla: "//host" y ".." no pueden
    // colarse en el destino. El decode va ANTES del chequeo porque
    // `URL.pathname` conserva el percent-encoding y `%2e%2e%2f` esquivaba el
    // filtro sin decodificar.
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return plain(404, "Not found");
    }
    if (decoded.includes("..") || decoded.includes("\0")) {
      return plain(404, "Not found");
    }

    const assetPath = `/${decoded.slice(BASE.length + 1).replace(/^\/+/, "")}`;
    const target = new URL(assetPath + url.search, url.origin);

    let response;
    try {
      response = await env.ASSETS.fetch(new Request(target, request));
    } catch {
      // Sin esto, un throw del binding devolvía la página de error 1101 del
      // runtime, que no lleva ningún header de seguridad.
      return plain(500, "Server error");
    }

    const headers = withSecurity(response.headers);
    // Los nombres no llevan fingerprint: revalidar siempre (ETag barato).
    headers.set("Cache-Control", "no-cache");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
