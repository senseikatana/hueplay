// Content collections: todo el contenido largo vive en markdown, no en el HTML.
// La app es una isla; esto es el libro.

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
// `z` desde `astro:content` está deprecado en Astro 7; la ruta viva es
// `astro/zod`, que reexporta zod v4.
import { z } from "astro/zod";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Orden en la cronología y en el índice. */
    order: z.number(),
    /** Rango de años que ocupa esta entrada, para la línea de tiempo. */
    year: z.number().optional(),
    era: z.string().optional(),
    /** Slug de ancla para enlazar desde la app. */
    anchor: z.string().optional(),
  }),
});

export const collections = { docs };
