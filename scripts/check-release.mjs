#!/usr/bin/env node
/**
 * Comprueba que la versión, el CHANGELOG, los tags y las releases de GitHub
 * estén sincronizados.
 *
 * Existe porque esa sincronización ya se rompió una vez: hubo una sección
 * `0.3.1` en el CHANGELOG que nunca tuvo tag ni release, y una `0.3.2` que
 * volvía a listar los mismos commits. Nada de eso falla en un build; sólo
 * aparece cuando alguien lee el changelog.
 *
 *   bun run release:check          # todo
 *   bun run release:check --offline  # sin consultar GitHub
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const offline = process.argv.includes("--offline");

const problems = [];
const checks = [];
const notes = [];

const ok = (name, detail = "") => checks.push({ name, detail, ok: true });
const warn = (name, detail = "") => checks.push({ name, detail, ok: "warn" });
const bad = (name, detail) => {
  checks.push({ name, detail, ok: false });
  problems.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const safeGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------- package.json

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const pkgVersion = pkg.version;

// --------------------------------------------------------------- CHANGELOG

const changelog = readFileSync("CHANGELOG.md", "utf8");
const changelogVersions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(
  (m) => m[1],
);

if (changelogVersions.length === 0) {
  bad("CHANGELOG tiene secciones de versión", "no se encontró ningún `## [x.y.z]`");
} else {
  ok("CHANGELOG tiene secciones de versión", `${changelogVersions.length} secciones`);
}

// ------------------------------------------------------------------- tags

const tags = (safeGit("tag", "-l", "v*") ?? "")
  .split("\n")
  .filter(Boolean)
  .map((t) => t.replace(/^v/, ""))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

/**
 * Versiones documentadas que anteceden al historial de git disponible.
 *
 * El repositorio arranca en `cff386c`, que ya es de la era de 0.2.1: no hay
 * ningún commit al que anclar 0.1.0 ni 0.2.0, así que no se pueden taguear
 * sin inventar historia. Se listan aquí a propósito para que la regla de abajo
 * siga teniendo dientes hacia adelante en vez de relajarse entera.
 */
const UNTAGGED_BY_DESIGN = new Set(["0.1.0", "0.2.0"]);

// 1. package.json debe coincidir con la versión más reciente del CHANGELOG
if (changelogVersions.length > 0) {
  const newest = changelogVersions[0];
  if (pkgVersion === newest) {
    ok("package.json coincide con el CHANGELOG", newest);
  } else {
    bad(
      "package.json coincide con el CHANGELOG",
      `package.json dice ${pkgVersion}, el CHANGELOG dice ${newest}`,
    );
  }
}

// 2. cada versión del CHANGELOG debe tener tag — esto caza las entradas fantasma
const untagged = changelogVersions.filter(
  (v) => !tags.includes(v) && !UNTAGGED_BY_DESIGN.has(v),
);
if (untagged.length === 0) {
  ok(
    "toda versión del CHANGELOG tiene su tag",
    tags.length > 0 ? tags.join(", ") : "ninguno",
  );
} else {
  bad(
    "toda versión del CHANGELOG tiene su tag",
    `sin tag: ${untagged.join(", ")} — o le falta el tag, o la sección no debería existir`,
  );
}

// 3. cada tag debe tener sección en el CHANGELOG — esto caza los tags huérfanos
const orphanTags = tags.filter((t) => !changelogVersions.includes(t));
if (orphanTags.length === 0) {
  ok("todo tag está documentado en el CHANGELOG");
} else {
  bad(
    "todo tag está documentado en el CHANGELOG",
    `tags sin sección: ${orphanTags.join(", ")}`,
  );
}

// 4. la versión de package.json debe estar tagueada
if (tags.includes(pkgVersion)) {
  ok(`v${pkgVersion} existe como tag`);
} else {
  bad(
    `v${pkgVersion} existe como tag`,
    `tags existentes: ${tags.join(", ") || "ninguno"}`,
  );
}

// 5. Una ref por encima del último tag es NORMAL entre releases, no un error:
//    lo anómalo es que eso no esté registrado en [Unreleased].
//
// La ref es configurable para poder revisar una rama antes de mergearla:
//   RELEASE_REF=origin/dev bun run release:check
const REF = process.env.RELEASE_REF ?? "origin/main";
const refSha = safeGit("rev-parse", REF);
const tagSha = tags.length > 0 ? safeGit("rev-list", "-n", "1", `v${tags[0]}`) : null;
if (refSha && tagSha) {
  if (refSha === tagSha) {
    ok(`${REF} está en el tag más reciente`, `v${tags[0]}`);
  } else {
    const ahead = Number(safeGit("rev-list", "--count", `v${tags[0]}..${REF}`));
    if (changelog.includes("## [Unreleased]")) {
      warn(
        `${REF} está en el tag más reciente`,
        `${ahead} commit(s) sin publicar, ya registrados en [Unreleased]`,
      );
    } else {
      bad(
        `${REF} está en el tag más reciente`,
        `${ahead} commit(s) por encima de v${tags[0]} y NO hay sección [Unreleased] que los registre`,
      );
    }
  }
}

// 6. cada tag debería tener su release en GitHub
if (offline) {
  ok("releases de GitHub", "omitido (--offline)");
} else {
  let released = [];
  let ghOk = true;
  try {
    released = JSON.parse(
      execFileSync("gh", ["release", "list", "--limit", "50", "--json", "tagName"], {
        encoding: "utf8",
      }),
    ).map((r) => r.tagName.replace(/^v/, ""));
  } catch {
    ghOk = false;
  }
  if (!ghOk) {
    ok("releases de GitHub", "omitido (gh no disponible o sin sesión)");
  } else {
    const missing = tags.filter((t) => !released.includes(t));
    if (missing.length === 0) {
      ok(`todo tag tiene release en GitHub`, released.join(", "));
    } else {
      bad(`todo tag tiene release en GitHub`, `sin release: ${missing.join(", ")}`);
    }
  }
}

// ------------------------------------------------------------------ informe

const pad = Math.max(...checks.map((c) => c.name.length));
const mark = { true: "✓", false: "✗", warn: "!" };
console.log("");
for (const c of checks) {
  const m = mark[String(c.ok)];
  console.log(`  ${m} ${c.name.padEnd(pad)}  ${c.detail}`);
  if (c.ok === "warn") notes.push(`${c.name} — ${c.detail}`);
}
console.log("");

if (notes.length > 0) {
  console.log(`  ${notes.length} aviso(s), no bloquean:\n`);
  for (const n of notes) console.log(`    • ${n}`);
  console.log("");
}

if (problems.length > 0) {
  console.error(`  ${problems.length} problema(s) de sincronización:\n`);
  for (const p of problems) console.error(`    • ${p}`);
  console.error("");
  process.exit(1);
}
console.log("  versión, changelog, tags y releases están sincronizados\n");
