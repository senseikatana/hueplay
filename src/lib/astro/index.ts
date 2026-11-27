/**
 * Minimal shape of an Astro content collection entry.
 *
 * @typeParam TData - The data shape attached to the entry (`entry.data`).
 */
export interface CollectionEntryLike<TData = unknown> {
  /** Unique id of the entry. */
  id: string;
  /** Optional slug used for static path params. */
  slug?: string;
  /** The entry's data payload. */
  data?: TData;
  /** Additional entry properties. */
  [key: string]: unknown;
}

/**
 * Configuration for path generation from a collection.
 *
 * @typeParam T - The item type in the collection.
 * @typeParam TParam - The URL param name (e.g. `"slug"`).
 * @typeParam TProps - The props type passed to each page.
 */
export interface PathsOptions<T, TParam extends string = string, TProps = T> {
  /** The URL param name. Defaults to `"slug"`. */
  param?: TParam;
  /** Function to extract the path value from an item. */
  valueFrom?: (item: T) => string | number;
  /** Function to extract the props object from an item. */
  propsFrom?: (item: T) => TProps;
  /** Function to return a full params record (overrides `param`/`valueFrom`). */
  paramsFrom?: (item: T) => Record<string, string>;
}

/**
 * A single Astro static path with typed params and props.
 *
 * @typeParam TParam - The URL param name.
 * @typeParam TProps - The props type passed to the page.
 */
export interface AstroPath<TParam extends string = string, TProps = unknown> {
  /** The path params, e.g. `{ slug: "hello-world" }`. */
  params: Record<TParam, string | undefined>;
  /** The props passed to the page. */
  props: TProps;
}

/**
 * Props passed to each page in a paginated Astro path.
 *
 * @typeParam T - The item type.
 */
export interface PaginationProps<T> {
  /** The items on this page. */
  items: T[];
  /** The 1-based current page number. */
  currentPage: number;
  /** The total number of pages. */
  totalPages: number;
}

/**
 * Safe Result (discriminated union without throwing).
 *
 * The `ok` flag narrows the union between the success and error branches.
 *
 * @typeParam TParam - The URL param name.
 * @typeParam TProps - The props type.
 */
export type AstroServiceResult<TParam extends string = string, TProps = unknown> =
  | { data: AstroPath<TParam, TProps>[]; error: null; ok: true }
  | { data: null; error: Error; ok: false };

/** Minimal slug/id shape used for default key extraction. */
type SlugLike = { slug?: string; id?: string };

/**
 * Convert a collection into Astro-compatible static paths.
 *
 * @typeParam T - The item type in the collection.
 * @typeParam TParam - The URL param name.
 * @typeParam TProps - The props type.
 * @param items - Collection items to convert.
 * @param options - Configuration for param name, value extraction and props.
 * @returns Array of Astro paths with params and props.
 *
 * @example
 * ```ts
 * // In Astro's getStaticPaths()
 * const posts = await getCollection("blog");
 * const paths = useAstroPathsFrom(posts, {
 *   param: "slug",
 *   valueFrom: (post) => post.slug,
 *   propsFrom: (post) => ({ title: post.data.title }),
 * });
 * // [{ params: { slug: "hello-world" }, props: { title: "Hello World" } }]
 * ```
 */
export function useAstroPathsFrom<T, TParam extends string = "slug", TProps = T>(
  items: T[],
  options: PathsOptions<T, TParam, TProps> = {},
): AstroPath<TParam, TProps>[] {
  const {
    param = "slug" as TParam,
    valueFrom = (item: T) => (item as SlugLike)?.slug ?? (item as SlugLike)?.id ?? "",
    propsFrom = (item: T) => item as unknown as TProps,
    paramsFrom,
  } = options;
  return items.map((item) => ({
    params: paramsFrom
      ? paramsFrom(item)
      : ({ [param]: String(valueFrom(item)) } as Record<TParam, string | undefined>),
    props: propsFrom(item),
  }));
}

/**
 * Fetch a collection and transform it into safe Astro paths.
 *
 * Returns a safe result instead of throwing on error.
 *
 * @typeParam TData - The entry data type.
 * @typeParam TParam - The URL param name.
 * @typeParam TProps - The props type.
 * @param getCollectionFn - Astro's `getCollection` function.
 * @param collectionName - Name of the collection to fetch.
 * @param options - Path generation options.
 * @returns Safe result with data or error.
 *
 * @example
 * ```ts
 * export async function getStaticPaths() {
 *   const result = await useAstroGetStaticPaths(getCollection, "blog");
 *   if (result.ok) return result.data;
 *   console.error(result.error);
 *   return [];
 * }
 * ```
 */
export async function useAstroGetStaticPaths<
  TData = unknown,
  TParam extends string = "slug",
  TProps = CollectionEntryLike<TData>,
>(
  getCollectionFn: (collection: string) => Promise<CollectionEntryLike<TData>[]>,
  collectionName: string,
  options: PathsOptions<CollectionEntryLike<TData>, TParam, TProps> = {},
): Promise<AstroServiceResult<TParam, TProps>> {
  try {
    const entries = await getCollectionFn(collectionName);
    return { data: useAstroPathsFrom(entries, options), error: null, ok: true };
  } catch (error) {
    return {
      data: null,
      error: new Error(
        `Error generating routes for collection "${collectionName}": ${error instanceof Error ? error.message : String(error)}`,
      ),
      ok: false,
    };
  }
}

/**
 * Find a collection entry by slug or custom key.
 *
 * @typeParam T - The item type in the collection.
 * @param items - Collection items to search.
 * @param value - Value to match (slug, id, etc.).
 * @param keyFrom - Optional function to extract the key from an item.
 * @returns Matched item or `null`.
 *
 * @example
 * ```ts
 * const posts = await getCollection("blog");
 * const post = useAstroFindEntry(posts, "hello-world");
 * if (post) console.log(post.data.title);
 * ```
 */
export function useAstroFindEntry<T>(
  items: T[],
  value: string,
  keyFrom?: (item: T) => string | number,
): T | null {
  const getKey =
    keyFrom ?? ((item: T) => (item as SlugLike)?.slug ?? (item as SlugLike)?.id ?? "");
  return items.find((item) => String(getKey(item)) === value) ?? null;
}

/**
 * Generate paginated Astro paths from a list of items.
 *
 * @typeParam T - The item type.
 * @typeParam TParam - The URL param name.
 * @param items - Items to paginate.
 * @param pageSize - Number of items per page (default: 10).
 * @param param - URL param name for page number (default: `"page"`).
 * @returns Array of Astro paths with pagination props.
 *
 * @example
 * ```ts
 * const posts = await getCollection("blog");
 * const pages = useAstroGeneratePagination(posts, 10);
 * // [{ params: { page: undefined }, props: { items: [...], currentPage: 1, totalPages: 3 } },
 * //  { params: { page: "2" }, props: { items: [...], currentPage: 2, totalPages: 3 } }, ...]
 * ```
 */
export function useAstroGeneratePagination<T, TParam extends string = "page">(
  items: T[],
  pageSize = 10,
  param: TParam = "page" as TParam,
): AstroPath<TParam, PaginationProps<T>>[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: totalPages }, (_, i) => {
    const currentPage = i + 1;
    return {
      params: (currentPage === 1
        ? { [param]: undefined }
        : { [param]: String(currentPage) }) as Record<TParam, string | undefined>,
      props: {
        items: items.slice(i * pageSize, (i + 1) * pageSize),
        currentPage,
        totalPages,
      },
    };
  });
}

/**
 * Convert simple values into Astro paths.
 *
 * @typeParam TParam - The URL param name.
 * @param values - Array of string or number values.
 * @param param - URL param name (default: `"slug"`).
 * @returns Array of Astro paths.
 *
 * @example
 * ```ts
 * const categories = ["tech", "design", "business"];
 * const paths = useAstroPathsFromValues(categories, "category");
 * // [{ params: { category: "tech" }, props: "tech" }, ...]
 * ```
 */
export function useAstroPathsFromValues<TParam extends string = "slug">(
  values: (string | number)[],
  param: TParam = "slug" as TParam,
): AstroPath<TParam, string | number>[] {
  return values.map((value) => ({
    params: { [param]: String(value) } as Record<TParam, string | undefined>,
    props: value,
  }));
}

/**
 * Extract unique values from a collection, supporting single values or arrays.
 *
 * @typeParam T - The item type.
 * @typeParam V - The extracted value type.
 * @param items - Collection items.
 * @param keyFrom - Function to extract value(s) from each item.
 * @returns Array of unique values.
 *
 * @example
 * ```ts
 * const posts = [{ tags: ["ts", "react"] }, { tags: ["ts", "vue"] }];
 * const tags = useAstroExtractUniqueValues(posts, (p) => p.tags);
 * // ["ts", "react", "vue"]
 * ```
 */
export function useAstroExtractUniqueValues<T, V>(
  items: T[],
  keyFrom: (item: T) => V | V[],
): V[] {
  return [...new Set(items.flatMap(keyFrom))];
}
