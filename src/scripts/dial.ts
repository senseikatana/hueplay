/**
 * La isla interactiva: dial, paneles, entrada de color, chips y estado de URL.
 *
 * Sin framework. Un solo `requestAnimationFrame` agrupa las escrituras, y cada
 * lectura del DOM está cacheada: lo que se escribe al DOM nunca vuelve a
 * leerse en el mismo frame.
 */

import {
  CHROMA_UNIT,
  clamp,
  formatHex,
  formatHsl,
  formatOklch,
  hslHueToOklchHue,
  hslToRgb,
  inSrgbGamut,
  oklchHueToHslHue,
  parseCssColor,
  parseOkLchTriple,
  primaryOklchHues,
  rgbToHsl,
  rgbToOklch,
  roundHue,
} from "../lib/color";

// --------------------------------------------------------------- referencias
//
// Se resuelven UNA vez. `updateUI` corre en cada frame de arrastre y antes
// hacía catorce `getElementById` por frame.

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id} en el DOM`);
  return el as T;
};

interface FieldDef {
  key: string;
  range: HTMLInputElement;
  num: HTMLInputElement;
  min: number;
  max: number;
}

const FIELDS: FieldDef[] = (
  [
    ["hslHue", 0, 360],
    ["hslSat", 0, 100],
    ["hslLight", 0, 100],
    ["oklchHue", 0, 360],
    ["oklchChroma", 0, 100],
    ["oklchLight", 0, 100],
  ] as const
).map(([key, min, max]) => ({
  key,
  range: byId<HTMLInputElement>(`${key}Slider`),
  num: byId<HTMLInputElement>(`${key}Num`),
  min,
  max,
}));

const els = {
  dial: byId("dialWrapper"),
  pointer: byId("pointer"),
  angle: byId("angleDisplay"),
  hslRing: byId("hslRing"),
  oklchRing: byId("oklchRing"),
  hslPreview: byId("hslPreview"),
  oklchPreview: byId("oklchPreview"),
  hslCode: byId("hslCode"),
  oklchCode: byId("oklchCode"),
  oklchGamut: byId("oklchGamut"),
  chipHex: byId("chipHex"),
  chipHsl: byId("chipHsl"),
  chipOklch: byId("chipOklch"),
  chips: byId("outputChips"),
  input: byId<HTMLInputElement>("colorInput"),
  inputError: byId("colorInputError"),
  apply: byId("applyColor"),
  copyStatus: byId("copyStatus"),
  colorStatus: byId("colorStatus"),
  gamutStatus: byId("gamutStatus"),
};

const value = (key: string): number => {
  const f = FIELDS.find((x) => x.key === key);
  return Number(f!.range.value);
};
const setRange = (key: string, v: number): void => {
  const f = FIELDS.find((x) => x.key === key);
  f!.range.value = String(v);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ------------------------------------------------------------------- anillos

/**
 * Sectores OKLCH de los primarios HSL a saturación y luz plenas. Es una
 * constante de la herramienta: depende sólo del modelo, no del estado. Antes se
 * recalculaba en cada `updateUI`, o sea siete conversiones por frame.
 */
const OKLCH_PRIMARY_HUES = primaryOklchHues(100, 50);

function paintRings(s: number, l: number, c: number, ol: number): void {
  els.hslRing.style.background = `conic-gradient(
      from 0deg,
      hsl(0, ${s}%, ${l}%) 0deg 60deg,
      hsl(60, ${s}%, ${l}%) 60deg 120deg,
      hsl(120, ${s}%, ${l}%) 120deg 180deg,
      hsl(180, ${s}%, ${l}%) 180deg 240deg,
      hsl(240, ${s}%, ${l}%) 240deg 300deg,
      hsl(300, ${s}%, ${l}%) 300deg 360deg
  )`;

  // El último tramo (magenta -> rojo) se pinta con el tono del rojo, cerrando
  // el círculo en 360°.
  const hues = OKLCH_PRIMARY_HUES.map((v, i) =>
    v === null
      ? null
      : i > 0 &&
          OKLCH_PRIMARY_HUES[i - 1] !== null &&
          v < OKLCH_PRIMARY_HUES[i - 1]! - 180
        ? v + 360
        : v,
  );

  // `hues` tiene 7 entradas: seis primarios más el rojo repetido ya desplazado
  // más allá de 360. El bucle tiene que ir hasta `length - 1` para pintar el
  // sector azul -> magenta; con `length - 2` ese tramo queda sin pintar.
  const stops: string[] = [];
  for (let i = 0; i < hues.length - 1; i++) {
    const from = i === 0 ? 0 : (hues[i - 1] as number);
    const at = hues[i] as number;
    stops.push(`oklch(${ol}% ${c}% ${round2(at)}) ${round2(from)}deg ${round2(at)}deg`);
  }
  // El tramo final cierra el círculo en 360° y se pinta con el tono del rojo.
  const last = (hues[hues.length - 2] as number) ?? 0;
  stops.push(
    `oklch(${ol}% ${c}% ${round2(hues[0] as number)}) ${round2(last)}deg 360deg`,
  );

  els.oklchRing.style.background = `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

/** Los tracks de tono llevan un gradiente estático: se pintan una sola vez. */
function paintHueTracks(): void {
  const hslStops: string[] = [];
  const oklchStops: string[] = [];
  for (let h = 0; h <= 360; h += 15) {
    hslStops.push(`hsl(${h}, 100%, 50%)`);
    oklchStops.push(`oklch(50% 50% ${h})`);
  }
  for (const f of FIELDS) {
    if (f.range.dataset.gradient !== "true") continue;
    const stops = f.key.startsWith("hsl") ? hslStops : oklchStops;
    f.range.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  }
}

// --------------------------------------------------------------------- tono

/**
 * El tono OKLCH se DERIVA del color del panel HSL. Mover saturación o luz
 * cambia el tono equivalente, y es justo el motivo por el que un hex no
 * "equivale" a un único oklch().
 */
function syncHue(source: string): void {
  // Tras pegar un color los tres tonos ya están puestos a mano, y al restaurar
  // desde la URL hay que respetar lo que el usuario compartió.
  if (source === "apply" || source === "init") return;

  const s = value("hslSat");
  const l = value("hslLight");

  if (source === "oklchHue") {
    const resolved = oklchHueToHslHue(value("oklchHue"), s, l, value("hslHue"));
    if (resolved !== null) setRange("hslHue", resolved);
    return;
  }

  const ok = hslHueToOklchHue(value("hslHue"), s, l);
  if (ok !== null) setRange("oklchHue", roundHue(ok));
}

// ------------------------------------------------------- anuncios accesibles
//
// Tres reglas, que son las que piden los issues #4/#5/#11:
//
//  1. El gamut se anuncia SÓLO al cambiar de estado. Entrar y salir se dicen una
//     vez; repetir el mismo estado en cada frame no dice nada.
//  2. El color se anuncia con retardo, para que arrastrar un slider no produzca
//     un announcement por frame.
//  3. Al soltar un control (change) o aplicar un color, el anuncio es inmediato:
//     quien opera con teclado no espera un retardo para oír el resultado.

let lastGamut: boolean | null = null;
let colorTimer = 0;

const announceGamut = (outOfGamut: boolean): void => {
  if (outOfGamut === lastGamut) return;
  lastGamut = outOfGamut;
  els.gamutStatus.textContent = outOfGamut
    ? "Atención: el color OKLCH actual está fuera del gamut de sRGB. El navegador va a mostrar un color con menos croma del que pediste."
    : "El color OKLCH actual vuelve a estar dentro del gamut de sRGB.";
};

const describeColor = (): string => {
  const hex = els.chipHex.textContent ?? "";
  const oklch = els.chipOklch.textContent ?? "";
  return `Color ${hex}, equivalente oklch ${oklch}.`;
};

const announceColor = (immediate: boolean): void => {
  window.clearTimeout(colorTimer);
  if (immediate) {
    els.colorStatus.textContent = describeColor();
    return;
  }
  colorTimer = window.setTimeout(() => {
    els.colorStatus.textContent = describeColor();
  }, 400);
};

// ----------------------------------------------------------------------- UI

function updateUI(source: string, immediate = false): void {
  syncHue(source);

  const hslH = value("hslHue");
  const s = value("hslSat");
  const l = value("hslLight");
  const okH = value("oklchHue");
  const c = value("oklchChroma");
  const ol = value("oklchLight");

  els.pointer.style.transform = `translateX(-50%) rotate(${hslH}deg)`;
  els.angle.textContent = `${hslH}°`;
  els.dial.setAttribute("aria-valuenow", String(hslH));
  els.dial.setAttribute("aria-valuetext", `${hslH} grados de tono HSL`);

  // No pisar el campo que se está escribiendo a mano.
  const editing = document.activeElement;
  for (const f of FIELDS) {
    if (f.num !== editing) f.num.value = String(value(f.key));
  }

  if (source !== "hslHue" && source !== "oklchHue") {
    paintRings(s, l, c, ol);
  }

  const hslRgb = hslToRgb(hslH, s, l);
  const okChroma = (c / 100) * CHROMA_UNIT;
  const hslColor = `hsl(${hslH}, ${s}%, ${l}%)`;
  const oklchColor = `oklch(${ol}% ${c}% ${okH})`;

  els.hslPreview.style.backgroundColor = hslColor;
  els.oklchPreview.style.backgroundColor = oklchColor;
  els.hslCode.textContent = hslColor;
  els.oklchCode.textContent = oklchColor;

  const outOfGamut = !inSrgbGamut(ol / 100, okChroma, okH);
  // `hidden` es lo contrario de "fuera de gamut": dentro de gamut -> oculta.
  els.oklchGamut.hidden = !outOfGamut;
  announceGamut(outOfGamut);

  els.chipHex.textContent = formatHex(hslRgb[0], hslRgb[1], hslRgb[2]);
  els.chipHsl.textContent = formatHsl(hslRgb[0], hslRgb[1], hslRgb[2]);
  els.chipOklch.textContent = formatOklch(hslRgb[0], hslRgb[1], hslRgb[2]);

  announceColor(immediate);
  scheduleUrlWrite();
}

/**
 * Un frame por lote. Arrastrar el dial dispara decenas de eventos `pointermove`
 * y antes cada uno escribía el DOM entero.
 */
let pendingFrame = 0;
let pendingSource = "init";
let pendingImmediate = false;
const scheduleUpdate = (source: string, immediate = false): void => {
  pendingSource = source;
  // Si en el mismo frame llegó un evento discreto, gana ése: hay que oír el
  // resultado de soltar el control, no el último frame del arrastre.
  pendingImmediate = pendingImmediate || immediate;
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    const immediateNow = pendingImmediate;
    pendingImmediate = false;
    updateUI(pendingSource, immediateNow);
  });
};

// --------------------------------------------------------------- estado URL

/**
 * `replaceState` en cada frame llenaría el historial de entrada y Safari corta
 * el historial de reemplazos (~100 llamadas / 30 s) lanzando `SecurityError`.
 * Con el try/catch silencioso, la URL compartible dejaba de actualizarse a
 * mitad de un arrastre sin avisar. El debounce lo evita.
 */
let urlTimer = 0;
function scheduleUrlWrite(): void {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    try {
      const params = new URLSearchParams();
      for (const f of FIELDS) params.set(f.key, String(value(f.key)));
      history.replaceState(
        null,
        "",
        `${location.pathname}?${params.toString()}${location.hash}`,
      );
    } catch {
      /* file:// lo prohíbe */
    }
  }, 200);
}

function readUrl(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    let found = false;
    for (const f of FIELDS) {
      const raw = params.get(f.key);
      // `Number("")` es 0 y es finito: un parámetro vacío reiniciaba el tono a
      // 0 en vez de ignorarse.
      if (raw === null || raw.trim() === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      setRange(f.key, clamp(Math.round(n), f.min, f.max));
      found = true;
    }
    return found;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ pegar un color

function applyColor(
  parsed: { r: number; g: number; b: number },
  typed?: { l: number; c: number; h: number } | null,
): void {
  const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const o = rgbToOklch(parsed.r, parsed.g, parsed.b);

  setRange("hslHue", roundHue(h));
  setRange("hslSat", Math.round(s));
  setRange("hslLight", Math.round(l));

  // El triple tecleado manda sobre el derivado: así el panel muestra lo que se
  // pidió aunque no quepa en sRGB y se enciende el aviso de gamut.
  const t = typed ?? { h: o.h, l: o.l, c: o.c };
  setRange("oklchHue", roundHue(t.h));
  setRange("oklchChroma", clamp(Math.round((t.c / CHROMA_UNIT) * 100), 0, 100));
  setRange("oklchLight", clamp(Math.round(t.l * 100), 0, 100));

  updateUI("apply", true);
}

function applyFromInput(): void {
  const raw = els.input.value.trim();

  if (!raw) {
    els.inputError.textContent =
      "Escribí un color: #ff0000, hsl(49 100% 50%) u oklch(…)";
    return;
  }

  const parsed = parseCssColor(raw);
  if (parsed === null) {
    els.inputError.textContent =
      `No reconozco «${raw}». Probá con #ff0000, hsl(49 100% 50%) u ` +
      `oklch(62.8% 64.42% 29.23). (CIE LCH no está soportado.)`;
    return;
  }

  els.inputError.textContent = "";
  applyColor(parsed, parseOkLchTriple(raw));
  els.input.value = formatHex(parsed.r, parsed.g, parsed.b);
}

// ------------------------------------------------------------------- clipboard

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* seguimos con el fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Sin top/left, `position: fixed` con offsets automáticos puede hacer
    // scroll al viewport en iOS.
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Un timer por chip: dos clics rápidos dejaban al primero pisar al segundo. */
const copyTimers = new WeakMap<Element, number>();

els.chips.addEventListener("click", async (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>(".chip");
  if (!chip) return;

  const key = chip.querySelector<HTMLElement>(".chip-key")!;
  const code = chip.querySelector("code")!;
  const original = key.dataset.label ?? key.textContent ?? "";
  key.dataset.label = original;

  window.clearTimeout(copyTimers.get(chip));
  const ok = await copyText(code.textContent ?? "");
  key.textContent = ok ? "✓ copiado" : "¡falló!";
  chip.classList.toggle("copied", ok);
  els.copyStatus.textContent = ok
    ? `Copiado ${original}: ${code.textContent}`
    : "No se pudo copiar al portapapeles";

  copyTimers.set(
    chip,
    window.setTimeout(() => {
      key.textContent = original;
      chip.classList.remove("copied");
    }, 1200),
  );
});

// ---------------------------------------------------------------------- dial

const MIN_DRAG_RADIUS = 30;

/**
 * El rect se cachea en `pointerdown`. Medirlo en cada `pointermove` era un
 * `getBoundingClientRect()` DESPUÉS de que `updateUI` escribiera el DOM, o sea
 * un reflow forzado por frame.
 */
let dialRect: DOMRect | null = null;
let activePointerId: number | null = null;

function handleDrag(event: PointerEvent): void {
  if (!dialRect) return;

  const dx = event.clientX - (dialRect.left + dialRect.width / 2);
  const dy = event.clientY - (dialRect.top + dialRect.height / 2);

  // Clics sobre el buje central: atan2(0,0) daría un ángulo arbitrario.
  if (Math.hypot(dx, dy) < MIN_DRAG_RADIUS) return;

  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  setRange("hslHue", roundHue(angle));
  scheduleUpdate("hslHue");
}

els.dial.addEventListener("pointerdown", (event) => {
  // Ignorar punteros adicionales: con dos dedos, ambos peleaban por el tono.
  if (activePointerId !== null) return;
  activePointerId = event.pointerId;

  try {
    els.dial.setPointerCapture(event.pointerId);
  } catch {
    // Sin captura el arrastre sigue: sólo se pierde el seguimiento al salir.
  }

  dialRect = els.dial.getBoundingClientRect();
  handleDrag(event);
});

els.dial.addEventListener("pointermove", (event) => {
  if (activePointerId === event.pointerId) handleDrag(event);
});

const endDrag = (event: PointerEvent): void => {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  dialRect = null;
  // Soltar es un evento discreto: se anuncia el color final de inmediato, sin
  // esperar el retardo de arrastre.
  scheduleUpdate("hslHue", true);
};
els.dial.addEventListener("pointerup", endDrag);
els.dial.addEventListener("pointercancel", endDrag);

// El dial se redimensiona con la ventana y se mueve con el scroll, así que el
// rect cacheado caduca. Invalidarlo a secas rompía el arrastre en curso: con
// `dialRect` en null, `handleDrag` salía temprano y el dial dejaba de responder
// hasta soltar y volver a pulsar. Ahora se vuelve a medir, que es barato y sólo
// pasa en resize/scroll.
const remeasure = (): void => {
  if (activePointerId === null) dialRect = null;
  else dialRect = els.dial.getBoundingClientRect();
};
window.addEventListener("resize", remeasure);
window.addEventListener("scroll", remeasure, { passive: true });

/**
 * Teclado. El dial es el control principal de la herramienta y sin esto quien no
 * puede arrastrar un puntero se queda sin la pieza central.
 */
els.dial.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 10 : 1;
  const current = roundHue(value("hslHue"));
  let next: number | null = null;

  switch (event.key) {
    case "ArrowRight":
    case "ArrowUp":
      next = current + step;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next = current - step;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = 359;
      break;
    default:
      return;
  }

  event.preventDefault();
  setRange("hslHue", roundHue(next));
  // Cada pulsación de tecla es un evento discreto que el usuario cuenta, así
  // que se anuncia sin retardo.
  scheduleUpdate("hslHue", true);
});

// ------------------------------------------------------- sliders y numéricos

for (const f of FIELDS) {
  // `input` es continuo (arrastre) → pasa por el retardo.
  f.range.addEventListener("input", () => scheduleUpdate(f.key));
  // `change` dispara al soltar el thumb: es el cierre, y se anuncia ya.
  f.range.addEventListener("change", () => scheduleUpdate(f.key, true));

  f.num.addEventListener("input", () => {
    const raw = f.num.value.trim();
    if (raw === "") {
      f.num.setAttribute("aria-invalid", "false");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      f.num.setAttribute("aria-invalid", "true");
      return;
    }
    // Fuera de rango se marca en el campo, no se ignora en silencio.
    f.num.setAttribute("aria-invalid", String(n < f.min || n > f.max));
    if (n < f.min || n > f.max) return;
    setRange(f.key, Math.round(n));
    scheduleUpdate(f.key);
  });

  f.num.addEventListener("change", () => {
    const n = Number(f.num.value);
    const fixed = clamp(
      Math.round(Number.isFinite(n) ? n : value(f.key)),
      f.min,
      f.max,
    );
    f.num.value = String(fixed);
    f.num.setAttribute("aria-invalid", "false");
    setRange(f.key, fixed);
    // `change` dispara al soltar o al hacer blur: es el cierre de la edición.
    scheduleUpdate(f.key, true);
  });
}

els.apply.addEventListener("click", applyFromInput);
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyFromInput();
  }
});
els.input.addEventListener("input", () => {
  els.inputError.textContent = "";
});

// ------------------------------------------------------------------- arranque

paintHueTracks();
readUrl();
// "apply" y no "init": re-derivar el tono OKLCH desde el panel HSL pisaba el
// `oklchHue` que venía en la URL, y una URL compartida no reproducía el color.
updateUI("apply", true);
