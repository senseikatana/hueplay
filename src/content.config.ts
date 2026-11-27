import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

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
    slug: z.string().optional(),
  }),
});

export const collections = { docs };
