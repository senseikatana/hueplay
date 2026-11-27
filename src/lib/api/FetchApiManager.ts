import type {
  ApiEntry,
  ApisConfig,
  FetchOptions,
  FetchResult,
  IFetchApiManager,
  PathParams,
  QueryParams,
  RequestInterceptor,
  UrlOptions,
} from "./types";

const MAX_ERROR_BODY_CHARS = 32 * 1024;

/**
 * Singleton HTTP client for registered APIs.
 *
 * Implements the Singleton pattern: a single instance maintains the registry of
 * APIs (`ApisConfig`) and centralizes URL construction and `fetch` requests,
 * always returning Safe Results (never throws on async routes).
 *
 * API registration is done once via `defineApiConfig` (or `FetchApiManager.getInstance().useInit()`).
 * After registration, use the exported helpers (`useFetch`, `useGet`, `usePost`, etc.)
 * to make requests. All methods return a `FetchResult` — check `result.ok` to safely
 * narrow between success and error branches.
 *
 * @example
 * ```ts
 * // 1. Declare the API once at module scope.
 * import { defineApiConfig } from "katanakit-js/client";
 *
 * export default defineApiConfig({
 *   pokeapi: {
 *     baseUri: "https://pokeapi.co/api/v2",
 *     endpoints: { pokemonById: "/pokemon/:id/" },
 *   },
 * });
 *
 * // 2. Call it — path params are typed from the endpoint name.
 * const result = await useFetch("pokeapi", "pokemonById", {
 *   params: { id: 25 },
 * });
 * if (result.ok) console.log(result.data.name); // "pikachu"
 * ```
 */
export class FetchApiManager implements IFetchApiManager {
  /** Module-level API registry. */
  apis: ApisConfig = {};
  /** Request interceptors in registration order. */
  requestInterceptors: { interceptor: RequestInterceptor }[] = [];
  /** Private singleton instance. */
  private static instance: FetchApiManager | null = null;

  /** Private constructor — use `FetchApiManager.getInstance()` instead. */
  private constructor() {}

  /**
   * Obtains the unique instance of FetchApiManager (Singleton).
   *
   * @returns The single instance of {@link FetchApiManager}.
   */
  static getInstance(): FetchApiManager {
    if (!FetchApiManager.instance) {
      FetchApiManager.instance = new FetchApiManager();
    }
    return FetchApiManager.instance;
  }

  /**
   * Internal: retrieves a registered API entry or throws.
   *
   * @param apiName - The key of the API in the registry.
   * @returns The {@link ApiEntry} for the given name.
   * @throws {Error} If the API is not registered.
   */
  private useGetApiEntry(apiName: string): ApiEntry {
    const api = this.apis[apiName];
    if (!api) {
      throw new Error(`[FetchApiManager] API "${apiName}" is not registered.`);
    }
    return api;
  }

  /**
   * Registers (merges) API definitions into the client registry.
   *
   * @param apisConfig - The API definitions to merge into the registry.
   *
   * @example
   * ```ts
   * FetchApiManager.getInstance().useInit({
   *   pokeapi: { baseUri: "https://pokeapi.co/api/v2", endpoints: { byId: "/pokemon/:id/" } },
   * });
   * ```
   */
  useInit(apisConfig: ApisConfig): void {
    this.apis = { ...this.apis, ...apisConfig };
  }

  /**
   * Returns a shallow copy of the registered APIs (safe to mutate locally).
   *
   * @returns A shallow copy of the current API registry.
   */
  useGetApis(): ApisConfig {
    return { ...this.apis };
  }

  /**
   * Alias for {@link useGetApis}.
   *
   * @returns A shallow copy of the current API registry.
   */
  useGetApisConfig(): ApisConfig {
    return this.useGetApis();
  }

  /**
   * Registers a request interceptor, which runs before `fetch` on every request.
   * Interceptors run sequentially in registration order and can mutate `url` or
   * `init`. The returned function unregisters this interceptor.
   *
   * @param interceptor - The function to run before the request is sent.
   * @returns A function that unregisters the interceptor.
   *
   * @example
   * ```ts
   * const unreg = useAddRequestInterceptor((request) => {
   *   request.init.headers.Authorization = `Bearer ${token}`;
   * });
   * // Later: unreg();
   * ```
   */
  useAddRequestInterceptor(interceptor: RequestInterceptor): () => void {
    const registration = { interceptor };
    this.requestInterceptors.push(registration);
    return () => {
      const index = this.requestInterceptors.indexOf(registration);
      if (index !== -1) this.requestInterceptors.splice(index, 1);
    };
  }

  /**
   * Returns the URL of a registered endpoint **without calling `fetch`**.
   *
   * It builds the same URL {@link useFetch} would request — same registry,
   * same `:param` substitution, same `query` merge with `defaultQueryParams`,
   * same http(s) guard — then stops and hands you the string.
   *
   * @param apiName - Registered API key (from `defineApiConfig`).
   * @param endpointName - Endpoint key inside that API.
   * @param options - `params` fills `:placeholders`, `query` becomes the search string.
   * @returns The fully built URL.
   * @throws {Error} Unknown API, unknown endpoint, or a scheme that is not http(s).
   *
   * @example
   * ```ts
   * useBuildUrl("pokeapi", "pokemonById", { params: { id: 25 } });
   * // → "https://pokeapi.co/api/v2/pokemon/25"
   * ```
   *
   * @remarks Synchronous, so it **throws** instead of returning a Safe Result —
   * Safe Result covers fallible async work, and this never leaves the process.
   */
  useBuildUrl(apiName: string, endpointName: string, options: UrlOptions = {}): string {
    const { params, query, ignoreDefaultQuery = false } = options;
    const api = this.useGetApiEntry(apiName);
    let path = api.endpoints?.[endpointName] ?? "";
    if (!path) {
      throw new Error(
        `[FetchApiManager] Endpoint "${endpointName}" not found in API "${apiName}".`,
      );
    }
    if (params) {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      path = Object.entries(params).reduce(
        (acc, [key, value]) =>
          acc.replace(
            new RegExp(`:${escapeRegex(key)}\\b`, "g"),
            encodeURIComponent(String(value)),
          ),
        path,
      );
    }
    const baseStr = api.baseUri instanceof URL ? api.baseUri.toString() : api.baseUri;
    const baseClean = baseStr.endsWith("/") ? baseStr.slice(0, -1) : baseStr;
    const pathClean = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${baseClean}${pathClean}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`[FetchApiManager] Scheme "${url.protocol}" is not allowed.`);
    }
    const defaultParams = ignoreDefaultQuery
      ? {}
      : (api.defaultQueryParams?.[endpointName] ?? {});
    const mergedQuery = { ...defaultParams, ...query };
    for (const [key, value] of Object.entries(mergedQuery)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  /**
   * Fetches a registered endpoint and returns a Safe Result.
   *
   * URL options sit at the top level, next to `method`/`headers`/`body` — no
   * nesting, same shape as `useGet` and Nuxt's `useFetch`.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param options - Fetch options: `params`, `query`, `transform` and any `RequestInit` field.
   * @returns A `FetchResult` with data or error. Never throws — a failing
   *   `transform` comes back as an error result too.
   *
   * @example
   * ```ts
   * const result = await useFetch<{ results: unknown[] }>(
   *   "pokeapi",
   *   "pokemons",
   *   { method: "GET", query: { limit: 2 } },
   * );
   * if (result.ok) console.log(result.data.results);
   * ```
   *
   * @remarks Fail closed on redirects: the scheme allow-list only validates the
   * initial URL, so following a 3xx could steer the request to a private host
   * (SSRF). Callers that need redirects can pass `redirect: "follow"`.
   */
  async useFetch<T = unknown>(
    apiName: string,
    endpointName: string,
    options: FetchOptions<T> = {},
  ): Promise<FetchResult<T>> {
    const { params, query, ignoreDefaultQuery, transform, ...init } = options;
    let url = "";
    try {
      url = this.useBuildUrl(apiName, endpointName, {
        params,
        query,
        ignoreDefaultQuery,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        data: null,
        error: { message: `Config Error: ${message}`, status: 0 },
        url,
        status: 0,
        ok: false,
      };
    }
    const interceptors = [...this.requestInterceptors];
    let request: { url: string; init: RequestInit } | undefined;
    if (interceptors.length > 0) {
      request = { url, init: { redirect: "error", ...init } };
      try {
        for (const { interceptor } of interceptors) {
          await interceptor(request);
        }
        const requestUrl = new URL(request.url);
        if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
          throw new Error(
            `Request URL scheme "${requestUrl.protocol}" is not allowed.`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        url = request.url;
        return {
          data: null,
          error: { message: `Request Interceptor Error: ${message}`, status: 0 },
          url,
          status: 0,
          ok: false,
        };
      }
      url = request.url;
    }
    try {
      const response = request
        ? await fetch(request.url, request.init)
        : await fetch(url, { redirect: "error", ...init });
      if (!response.ok) {
        const errorDetails = await readBody(response, MAX_ERROR_BODY_CHARS);
        return {
          data: null,
          error: {
            message: `HTTP Error: ${response.statusText || "Unsuccessful response"}`,
            status: response.status,
            details: errorDetails,
          },
          url: response.url || url,
          status: response.status,
          ok: false,
        };
      }
      const body = response.status === 204 ? null : await readBody(response);
      let data = body;
      if (transform) {
        try {
          data = await transform(body);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            data: null,
            error: { message: `Transform Error: ${message}`, status: response.status },
            url: response.url || url,
            status: response.status,
            ok: false,
          };
        }
      }
      return {
        data: data as T,
        error: null,
        url: response.url || url,
        status: response.status,
        ok: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        data: null,
        error: { message: `Network/Client Error: ${message}`, status: 0 },
        url,
        status: 0,
        ok: false,
      };
    }
  }

  /**
   * GET helper over a registered API endpoint.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await useGet("pokeapi", "pokemonById", { params: { id: 25 } });
   * if (result.ok) console.log(result.data.name); // "pikachu"
   * ```
   */
  useGet<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useFetch(apiName, endpointName, {
      method: "GET",
      ...pickUrl(urlOptions),
    });
  }

  /**
   * GET helper alias for {@link useGet}.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await useGetApi("pokeapi", "pokemonById", { params: { id: 25 } });
   * if (result.ok) console.log(result.data.name); // "pikachu"
   * ```
   */
  useGetApi<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useGet(apiName, endpointName, urlOptions);
  }

  /**
   * POST helper over a registered API endpoint.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param body - Optional request body (auto-serialized to JSON unless raw).
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await usePost("pokeapi", "createPokemon", { name: "Pikachu" });
   * if (result.ok) console.log(result.data.name); // "Pikachu"
   * ```
   */
  usePost<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useFetch(apiName, endpointName, {
      method: "POST",
      ...serializeBody(body),
      ...pickUrl(urlOptions),
    });
  }

  /**
   * PUT helper over a registered API endpoint.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param body - Optional request body (auto-serialized to JSON unless raw).
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await usePut("pokeapi", "updatePokemon", { id: 25 }, { params: { id: 25 } });
   * if (result.ok) console.log(result.data);
   * ```
   */
  usePut<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useFetch(apiName, endpointName, {
      method: "PUT",
      ...serializeBody(body),
      ...pickUrl(urlOptions),
    });
  }

  /**
   * PATCH helper over a registered API endpoint.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param body - Optional request body (auto-serialized to JSON unless raw).
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await usePatch("pokeapi", "updatePokemon", { name: "Pikachu" });
   * if (result.ok) console.log(result.data.name); // "Pikachu"
   * ```
   */
  usePatch<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useFetch(apiName, endpointName, {
      method: "PATCH",
      ...serializeBody(body),
      ...pickUrl(urlOptions),
    });
  }

  /**
   * DELETE helper over a registered API endpoint.
   *
   * @param apiName - The registered API key.
   * @param endpointName - The endpoint key within the API.
   * @param urlOptions - Optional URL building options.
   * @returns A `FetchResult` with data or error.
   *
   * @example
   * ```ts
   * const result = await useDelete("pokeapi", "deletePokemon", { params: { id: 25 } });
   * if (result.ok) console.log("deleted");
   * ```
   */
  useDelete<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>> {
    return this.useFetch(apiName, endpointName, {
      method: "DELETE",
      ...pickUrl(urlOptions),
    });
  }
}

/**
 * Internal: reads a Response body, attempting JSON parse for JSON content types.
 *
 * @param response - The fetch Response to read.
 * @param maxChars - Maximum characters to read before truncating.
 * @returns The parsed body or `null` for empty responses.
 */
async function readBody(response: Response, maxChars?: number): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  if (maxChars !== undefined && text.length > maxChars) {
    return `${text.slice(0, maxChars)}… [truncated]`;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Internal: serializes a request body.
 *
 * Leaves FormData / Blob / URLSearchParams / ArrayBuffer / TypedArray /
 * ReadableStream / string untouched (no forced JSON Content-Type so the
 * runtime can set the multipart boundary).
 *
 * @param body - The body to serialize.
 * @returns An object with optional `body` and `headers` for `fetch`.
 */
function serializeBody(body: unknown): { body?: BodyInit; headers?: HeadersInit } {
  if (body === undefined) return {};
  const isRawBody =
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) ||
    typeof body === "string";
  if (isRawBody) {
    return { body: body as BodyInit };
  }
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Internal: picks the URL-building keys out of an options bag so nothing else leaks into
 * the `RequestInit` handed to `fetch`.
 *
 * @param urlOptions - Legacy URL options, if any.
 * @returns Only `params`, `query` and `ignoreDefaultQuery`, when defined.
 */
function pickUrl(urlOptions?: UrlOptions): {
  params?: PathParams;
  query?: QueryParams;
  ignoreDefaultQuery?: boolean;
} {
  if (!urlOptions) return {};
  const { params, query, ignoreDefaultQuery } = urlOptions;
  return {
    ...(params !== undefined && { params }),
    ...(query !== undefined && { query }),
    ...(ignoreDefaultQuery !== undefined && { ignoreDefaultQuery }),
  };
}
