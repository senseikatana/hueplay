#!/usr/bin/env node
/**
 * Publicación en un solo paso: verificar, sincronizar y volver a verificar.
 *
 *   bun run release            # check -> sync -> check
 *   bun run release --dry-run  # muestra qué haría, sin tocar GitHub
 *
 * El check final importa: confirma que la sincronización effectivement dejó
 * las releases alineadas con el changelog, en vez de asumirlo.
 *
 * Los comandos por separado (`release:check`, `release:sync`) siguen
 * disponibles para scripts y CI, donde encadenarlos a mano es ruido.
 */

import { spawnSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");

const run = (script, extra = []) => {
  const r = spawnSync("node", [script, ...extra], { stdio: "inherit" });
  return r.status === 0;
};

const step = (n, title) => console.log(`\n\x1b[1m[${n}/3] ${title}\x1b[0m\n`);

console.log(
  dryRun
    ? "\n  Modo simulación: no se modifica nada en GitHub."
    : "\n  Sincronizando changelog, tags y releases.",
);

step(1, "Verificando el estado actual");
if (!run("scripts/check-release.mjs")) {
  console.error(
    "\n  Hay problemas que la sincronización no puede resolver (una versión\n" +
      "  sin tag, un tag sin sección, releases que faltan). Corregilos primero.\n",
  );
  process.exit(1);
}

step(2, "Empujando el changelog a cada release");
run("scripts/sync-release.mjs", dryRun ? ["--dry-run"] : []);

step(3, "Verificando que la sincronización funcionó");
if (!run("scripts/check-release.mjs")) {
  console.error(
    "\n  La sincronización no dejó todo alineado. Revisá la salida de arriba.\n",
  );
  process.exit(1);
}

console.log("  Todo sincronizado.\n");
