#!/usr/bin/env node
/**
 * End-to-end checks against a real browser.
 *
 * These are NOT part of `bun test`: they need a built site, a server and a real
 * DOM, so they run separately via `bun run test:e2e`. The value they add over
 * the unit suite is that they exercise the assembled page — Pointer Events,
 * `aria-live`, URL state, and the Astro build output — none of which the pure
 * colour library can see.
 *
 * Zero dependencies: the browser is driven over the DevTools Protocol using
 * Node's built-in WebSocket, and the site is served by `astro preview`.
 *
 *   bun run build && bun run test:e2e
 */

import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4321;
const CDP_PORT = 9333;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/hueplay/`;
const CDP = `http://127.0.0.1:${CDP_PORT}`;
const DIST = resolve("dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/**
 * Servidor estático mínimo sobre `dist/`.
 *
 * No se usa `astro preview` a propósito: en Astro 7 corre como daemon y deja
 * un proceso zombi si el test muere, así que el arranque y el apagado dejan de
 * ser deterministas. Además, replicar aquí el comportamiento de trailing-slash
 * deja estos checks probing el build real y no una emulación.
 */
function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", ORIGIN);
    const rel = normalize(url.pathname.replace(/^\/hueplay\/?/, "")).replace(
      /^(\.\.[/\\])+/,
      "",
    );
    let file = join(DIST, rel === "/" || rel === "." ? "index.html" : rel);

    if (!file.startsWith(DIST)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    // Directorio: redirigir con slash, como `auto-trailing-slash`.
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(307, { location: `${url.pathname}/` }).end();
        return;
      }
      file = join(file, "index.html");
    }

    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });

  return new Promise((done) => server.listen(PORT, "127.0.0.1", () => done(server)));
}

/** El ejecutable se resuelve por PATH, no hardcodeando rutas del sistema. */
const BROWSER_NAMES = ["google-chrome", "chromium", "chromium-browser", "chrome"];

function findBrowser() {
  if (process.env.CHROME_PATH) {
    return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  }
  for (const name of BROWSER_NAMES) {
    const which = spawnSync("which", [name], { encoding: "utf8" });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  }
  // macOS no instala el binario en un directorio de PATH.
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return existsSync(mac) ? mac : null;
}

const pass = [];
const fail = [];
const check = (name, ok, detail = "") =>
  ok ? pass.push(name) : fail.push(`${name}${detail ? ` → ${detail}` : ""}`);

// ---------------------------------------------------------------- arranque

function waitFor(url, tries, label) {
  return (async () => {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url);
        if (res.ok || res.status === 404) return true;
      } catch {
        /* aún no levanta */
      }
      await sleep(250);
    }
    throw new Error(`${label} no respondió en ${tries} intentos`);
  })();
}

async function main() {
  if (!existsSync("dist/index.html")) {
    console.error("✗ No hay build. Ejecutá `bun run build` primero.");
    process.exit(1);
  }

  const browser = findBrowser();
  if (!browser) {
    console.error(
      "✗ No encontré Chrome ni Chromium. Configurá CHROME_PATH para apuntar al binario.",
    );
    process.exit(1);
  }

  const server = await startServer();
  const chrome = spawn(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      `--remote-debugging-port=${CDP_PORT}`,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const cleanup = () => {
    server.close();
    chrome.kill();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitFor(BASE, 120, "el sitio");
    await waitFor(`${CDP}/json/version`, 40, "el navegador");
  } catch (err) {
    cleanup();
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------------- CDP

  const tabs = await (await fetch(`${CDP}/json/list`)).json();
  const page = tabs.find((t) => t.type === "page");
  if (!page) {
    cleanup();
    throw new Error("el navegador no expone ninguna pestaña");
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const consoleErrors = [];

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(
        msg.params.exceptionDetails?.exception?.description ?? "excepción",
      );
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(
        (msg.params.args ?? []).map((a) => a.value ?? a.description).join(" "),
      );
    }
    const resolver = pending.get(msg.id);
    if (resolver) {
      pending.delete(msg.id);
      resolver(msg);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (msg) =>
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result),
      );
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "error");
    }
    return r.result.value;
  };

  const goto = async (url) => {
    await send("Page.enable");
    await send("Page.navigate", { url });
    await sleep(1400);
  };

  await send("Runtime.enable");

  const num = (id) => `document.getElementById('${id}Num').value`;
  /** Avanza dos frames: el rAF del dial necesita uno para agrupar y otro para aplicar. */
  const settle = `const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`;
  /**
   * Inyecta código en la página. No declara variables a propósito: estas
   * expresiones se evalúan como un solo script y `setRange` se usa varias veces
   * dentro de la misma, así que un `const` repetiría el identificador.
   */
  const setRange = (id, v) =>
    `document.getElementById('${id}Slider').value = String(${v});` +
    ` document.getElementById('${id}Slider')` +
    `.dispatchEvent(new Event('input', { bubbles: true }));`;

  // ------------------------------------------------------------- los checks

  // 1. Estado inicial
  await goto(BASE);
  const init = await evaluate(`({
    hslHue: ${num("hslHue")}, hslSat: ${num("hslSat")}, hslLight: ${num("hslLight")},
    oklchHue: ${num("oklchHue")}, oklchChroma: ${num("oklchChroma")}, oklchLight: ${num("oklchLight")},
    hslCode: document.getElementById('hslCode').textContent,
    oklchCode: document.getElementById('oklchCode').textContent,
  })`);
  check(
    "el estado inicial es HSL 0/65/50 con el tono OKLCH derivado a 29",
    init.hslHue === "0" &&
      init.hslSat === "65" &&
      init.hslLight === "50" &&
      init.oklchHue === "29",
    JSON.stringify(init),
  );
  check(
    "los códigos iniciales son correctos",
    init.hslCode === "hsl(0, 65%, 50%)" && init.oklchCode === "oklch(50% 65% 29)",
    `${init.hslCode} / ${init.oklchCode}`,
  );

  // 2. Estado compartido en la URL (#6)
  await goto(
    `${BASE}?hslHue=0&hslSat=100&hslLight=50&oklchHue=200&oklchChroma=80&oklchLight=60`,
  );
  const urlState = await evaluate(`({
    oklchHue: ${num("oklchHue")}, oklchChroma: ${num("oklchChroma")}, oklchLight: ${num("oklchLight")},
    code: document.getElementById('oklchCode').textContent,
  })`);
  check(
    "una URL compartida restaura los seis valores, incluido oklchHue",
    urlState.oklchHue === "200" &&
      urlState.oklchChroma === "80" &&
      urlState.oklchLight === "60" &&
      urlState.code === "oklch(60% 80% 200)",
    JSON.stringify(urlState),
  );

  // 3. Los límites del control numérico (#6)
  await goto(BASE);
  const bounds = await evaluate(`(async () => { ${settle}
    const n = document.getElementById('hslSatNum');
    n.value = '999'; n.dispatchEvent(new Event('input', { bubbles: true })); await wait();
    const invalid = n.getAttribute('aria-invalid');
    const during = document.getElementById('hslSatSlider').value;
    n.dispatchEvent(new Event('change', { bubbles: true })); await wait();
    return { invalid, during, after: n.value };
  })()`);
  check(
    "escribir fuera de rango marca aria-invalid y no mueve nada hasta el blur",
    bounds.invalid === "true" && bounds.during === "65",
    JSON.stringify(bounds),
  );
  check(
    "al soltar el campo se recorta al máximo",
    bounds.after === "100",
    JSON.stringify(bounds),
  );

  // 4. Round-trip de tono
  await goto(BASE);
  const roundTrip = await evaluate(`(async () => { ${settle}
    ${setRange("hslHue", 49)} ${setRange("hslSat", 100)} ${setRange("hslLight", 50)} await wait();
    const ok = Number(document.getElementById('oklchHueNum').value);
    ${setRange("oklchHue", 92)} await wait();
    return { ok, back: Number(document.getElementById('hslHueNum').value) };
  })()`);
  check(
    "el tono OKLCH de #ffd000 es 92 y el round-trip vuelve a 49",
    roundTrip.ok === 92 && roundTrip.back === 49,
    JSON.stringify(roundTrip),
  );

  // 5. Saturación 0% congela el tono, no lo reinicia
  await goto(BASE);
  const achromatic = await evaluate(`(async () => { ${settle}
    const before = document.getElementById('oklchHueNum').value;
    ${setRange("hslSat", 0)} await wait();
    return { before, after: document.getElementById('oklchHueNum').value };
  })()`);
  check(
    "saturación 0% congela el tono OKLCH en su último valor",
    achromatic.after === achromatic.before,
    JSON.stringify(achromatic),
  );

  // 6. Entrada de color (#12)
  await goto(BASE);
  const paste = await evaluate(`(async () => { ${settle}
    const inp = document.getElementById('colorInput');
    inp.value = '#ffd000'; document.getElementById('applyColor').click(); await wait();
    return { field: inp.value, chip: document.getElementById('chipOklch').textContent };
  })()`);
  check(
    "pegar un color lo normaliza y los chips son la conversión del color en pantalla",
    paste.field === "#ffd000" && paste.chip === "oklch(87.35% 44.68% 92.34)",
    `${paste.field} / ${paste.chip}`,
  );

  const badInput = await evaluate(`(async () => { ${settle}
    const before = document.getElementById('hslCode').textContent;
    const inp = document.getElementById('colorInput');
    inp.value = 'basura'; document.getElementById('applyColor').click(); await wait();
    return { err: document.getElementById('colorInputError').textContent, before,
             after: document.getElementById('hslCode').textContent };
  })()`);
  check(
    "una entrada inválida da error inline y no toca el estado",
    badInput.err.length > 0 && badInput.before === badInput.after,
    `${badInput.before} vs ${badInput.after}`,
  );

  for (const [label, value, shouldLight] of [
    ["oklch(50% 100% 30)", "oklch(50% 100% 30)", true],
    ["#ff0000 (rojo puro, no es falsa alarma)", "#ff0000", false],
  ]) {
    const r = await evaluate(`(async () => { ${settle}
      document.getElementById('colorInput').value = '${value}';
      document.getElementById('applyColor').click(); await wait();
      return { badge: !document.getElementById('oklchGamut').hidden,
               code: document.getElementById('oklchCode').textContent };
    })()`);
    check(
      `insignia de gamut para ${label}`,
      r.badge === shouldLight,
      `badge=${r.badge}`,
    );
    if (shouldLight) {
      check("el panel conserva lo tecleado aunque no quepa", r.code === value, r.code);
    }
  }

  const lch = await evaluate(`(async () => { ${settle}
    document.getElementById('colorInput').value = 'lch(54.29% 106.84 40.86)';
    document.getElementById('applyColor').click(); await wait();
    return document.getElementById('colorInputError').textContent;
  })()`);
  check(
    "lch() se rechaza con un error inline",
    lch.includes("No reconozco"),
    lch.slice(0, 50),
  );

  // 7. Teclado en el dial (#4)
  await goto(BASE);
  const keyboard = await evaluate(`(async () => { ${settle}
    const dial = document.getElementById('dialWrapper');
    dial.focus();
    const focused = document.activeElement === dial;
    const before = Number(document.getElementById('hslHueNum').value);
    const press = (key, shift = false) => dial.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
    press('ArrowRight'); await wait();
    const right = Number(document.getElementById('hslHueNum').value);
    press('ArrowRight', true); await wait();
    const shift = Number(document.getElementById('hslHueNum').value);
    press('End'); await wait();
    return { focused, before, right, shift, end: Number(document.getElementById('hslHueNum').value),
             aria: dial.getAttribute('aria-valuenow') };
  })()`);
  check("el dial recibe foco", keyboard.focused === true);
  check(
    "flecha derecha suma 1",
    keyboard.right === keyboard.before + 1,
    JSON.stringify(keyboard),
  );
  check(
    "Shift+flecha suma 10",
    keyboard.shift === keyboard.right + 10,
    JSON.stringify(keyboard),
  );
  check("End lleva a 359", keyboard.end === 359, `end=${keyboard.end}`);
  check(
    "aria-valuenow va sincronizado",
    keyboard.aria === "359",
    `aria=${keyboard.aria}`,
  );

  // 8. Anuncios accesibles (#4, #5, #11)
  await goto(BASE);
  const a11y = await evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const gamut = document.getElementById('gamutStatus');
    const color = document.getElementById('colorStatus');
    const outOfGamut = () => !document.getElementById('oklchGamut').hidden;

    const state0 = { gamut: outOfGamut(), said: gamut.textContent };

    // Mover la croma sin cambiar el estado de gamut: no debe anunciarse.
    const c = document.getElementById('oklchChromaSlider');
    c.value = '64'; c.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(500);
    const sameState = gamut.textContent;

    // Entrar en gamut: sí debe anunciarse.
    c.value = '10'; c.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(300);
    const entered = gamut.textContent;

    // Repetir el mismo estado: no vuelve a hablar.
    c.value = '11'; c.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(300);
    const repeated = gamut.textContent;

    return {
      live: gamut.getAttribute('aria-live'),
      exists: !!gamut && !!color,
      colorLive: color.getAttribute('aria-live'),
      state0, saidSameState: sameState, entered, repeated,
      inGamutNow: outOfGamut(),
      colorSaid: color.textContent,
    };
  })()`);

  check("existen regiones live para color y gamut", a11y.exists === true);
  check(
    "las regiones son polite",
    a11y.live === "polite" && a11y.colorLive === "polite",
  );

  check(
    "repetir el mismo estado de gamut NO se anuncia",
    a11y.saidSameState === a11y.state0.said,
    `"${a11y.saidSameState}" vs "${a11y.state0.said}"`,
  );
  check(
    "entrar y salir de gamut SÍ se anuncia",
    a11y.entered !== a11y.state0.said && a11y.entered.length > 0,
    a11y.entered.slice(0, 60),
  );
  check(
    "volver al mismo estado no repite el anuncio",
    a11y.repeated === a11y.entered,
    `"${a11y.repeated.slice(0, 40)}"`,
  );
  check(
    "el color se anuncia a un lector de pantalla",
    a11y.colorSaid.includes("#"),
    a11y.colorSaid.slice(0, 50),
  );

  // 9. El demo educativo
  const demo = await evaluate(`(async () => { ${settle}
    const cells = document.querySelectorAll('.lie-swatch');
    const toggle = document.getElementById('lieGreysToggle');
    toggle.click(); await wait();
    return { n: cells.length, pressed: toggle.getAttribute('aria-pressed'),
             verdict: document.getElementById('lieVerdict').textContent };
  })()`);
  check("el demo dibuja 24 muestras", demo.n === 24, `n=${demo.n}`);
  check(
    "el veredicto reporta la dispersión de luminosidad",
    demo.verdict.includes("49.0"),
    demo.verdict.slice(0, 70),
  );
  check("el toggle se marca presionado", demo.pressed === "true");

  // 10. La guía de campo
  await goto(`${BASE}historia/`);
  const docs = await evaluate(`({
    timeline: document.querySelectorAll('.timeline li').length,
    tables: document.querySelectorAll('table').length,
    // Los ids de la colección salen del nombre del archivo y empiezan con
    // dígitos ("01-historia"), así que NO valen como selector CSS: hay que
    // usar getElementById.
    anchors: [...document.querySelectorAll('.timeline a')].every(
      a => !!document.getElementById(a.getAttribute('href').slice(1))),
  })`);
  check(
    "la guía renderiza los cuatro documentos",
    docs.timeline === 4,
    `timeline=${docs.timeline}`,
  );
  check("la guía tiene tablas", docs.tables >= 2, `tables=${docs.tables}`);
  check(
    "todos los enlaces de la cronología resuelven a un id real",
    docs.anchors === true,
  );

  check(
    "sin errores de JS en ninguna página",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(" | "),
  );

  ws.close();
  cleanup();

  // ------------------------------------------------------------- resumen

  console.log(`\n  ${pass.length} comprobaciones OK`);
  for (const p of pass) console.log(`    ✓ ${p}`);
  if (fail.length) {
    console.log(`\n  ${fail.length} FALLAS`);
    for (const f of fail) console.log(`    ✗ ${f}`);
    process.exit(1);
  }
  console.log("\n  todo verde");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
