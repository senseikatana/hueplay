#!/usr/bin/env node
/**
 * Empuja la sección de una versión del CHANGELOG a su release de GitHub, para
 * que las dos no diverjan.
 *
 *   bun run release:sync           # sincroniza todas las versiones tagueadas
 *   bun run release:sync 0.3.2     # sólo una
 *   bun run release:sync 0.3.2 --dry-run
 *
 * El CHANGELOG es la fuente de verdad (Keep a Changelog). La release es una
 * proyección de él: si hay que elegir, se edita el CHANGELOG y después se
 * corre esto.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => !a.startsWith("--"));

const changelog = readFileSync("CHANGELOG.md", "utf8");

/** Extrae el cuerpo de `## [x.y.z]` hasta la siguiente sección de versión. */
function section(version) {
  const start = changelog.indexOf(`## [${version}]`);
  if (start === -1) return null;
  const rest = changelog.slice(start);
  const next = rest.slice(1).search(/^## \[[\d.]+\]/m);
  const raw = next === -1 ? rest : rest.slice(0, next + 1);
  // Se descarta la primera línea (el encabezado de versión).
  return raw.slice(raw.indexOf("\n") + 1).trim();
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const tags = git("tag", "-l", "v*")
  .split("\n")
  .filter(Boolean)
  .map((t) => t.replace(/^v/, ""));

const versions = only ? [only] : tags;

if (versions.length === 0) {
  console.error("No hay tags; nada que sincronizar.");
  process.exit(1);
}

let changed = 0;

for (const version of versions) {
  const body = section(version);
  if (body === null) {
    console.warn(
      `  ⚠ ${version}: no hay sección en el CHANGELOG — se deja la release como está`,
    );
    continue;
  }
  if (!tags.includes(version)) {
    console.warn(`  ⚠ ${version}: sin tag — se omite`);
    continue;
  }

  const dir = mkdtempSync(join(tmpdir(), "rel-"));
  const file = join(dir, "notes.md");
  writeFileSync(file, body + "\n");

  if (dryRun) {
    console.log(
      `  · v${version} — se actualizaría (${body.split("\n").length} líneas)`,
    );
    continue;
  }

  try {
    execFileSync("gh", ["release", "edit", `v${version}`, "--notes-file", file], {
      stdio: "pipe",
    });
    console.log(`  ✓ v${version} sincronizada con el CHANGELOG`);
    changed++;
  } catch (err) {
    console.error(
      `  ✗ v${version}: ${
        String(err.stderr ?? err.message)
          .trim()
          .split("\n")[0]
      }`,
    );
    process.exitCode = 1;
  }
}

if (!dryRun) {
  console.log(`\n  ${changed} release(s) sincronizada(s)\n`);
}
