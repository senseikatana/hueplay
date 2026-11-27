// @ts-check
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import astro from "eslint-plugin-astro";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

/**
 * Flat config de ESLint 9.
 *
 * Reglas oficiales (documentación de cada plugin):
 *   - @eslint/js recommended                      (JavaScript)
 *   - @typescript-eslint recommended               (TypeScript base)
 *   - @typescript-eslint recommended-type-checked  (TypeScript con tipos, solo .ts)
 *   - eslint-plugin-astro flat/recommended         (Astro)
 *   - eslint-config-prettier                       (apaga reglas de estilo que chocan con Prettier)
 *   - eslint-plugin-prettier                       (formato como error de lint)
 *
 * Globals: `globals.node` para scripts de Node y tests, `globals.browser` para
 * el DOM del dial y componentes Astro.
 */
const TS_FILES = ["**/*.ts", "**/*.mts", "**/*.cts"];
const CODE_FILES = ["**/*.{js,mjs,ts,mts,cts,astro}"];

export default [
  { ignores: ["dist/", ".astro/", "node_modules/", "public/"] },

  js.configs.recommended,

  // Reglas base de TypeScript + globals para todo el código.
  {
    files: CODE_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].rules,
      ...tsPlugin.configs.recommended.rules,
    },
  },

  // Reglas type-checked de TypeScript (solo archivos .ts tipados por tsconfig).
  {
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs["recommended-type-checked-only"].rules,
      // Los manejadores de evento async del DOM son intencionales.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },

  // Reglas recomendadas de Astro (parser y processor incluidos).
  ...astro.configs["flat/recommended"],

  // Prettier como error de lint sobre todo el código.
  {
    files: CODE_FILES,
    plugins: { prettier: prettierPlugin },
    rules: { "prettier/prettier": "error" },
  },

  prettierConfig,
];
