// @ts-check
import { defineConfig } from "astro/config";

// El site vive montado en `/hueplay/*` sobre el dominio apex, no en la raíz.
// `base` hace que Astro emita las URLs de assets con ese prefijo, que es lo que
// el edge router de worker.js sabe desenvolver.
export default defineConfig({
  site: "https://senseikatana.com",
  base: "/hueplay",
  trailingSlash: "always",
  outDir: "./dist",

  // El toolbar de dev inyecta elementos en el DOM y estorba al medir el dial.
  devToolbar: { enabled: false },

  build: {
    assets: "_astro",
    inlineStylesheets: "auto",
  },

  markdown: {
    shikiConfig: { theme: "github-dark" },
  },
});
