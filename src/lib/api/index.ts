import { FetchApiManager } from "./FetchApiManager";
import type {
  ApiEntry,
  ApisConfig,
  FetchOptions,
  FetchResult,
  RequestInterceptor,
  UrlOptions,
} from "./types";

export { FetchApiManager };

function isApiEntry(value: unknown): value is ApiEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "baseUri" in value &&
    "endpoints" in value
  );
}

function splitConfig(input: Record<string, unknown>): {
  config: Record<string, unknown>;
  methods: Record<string, unknown>;
} {
  const config: Record<string, unknown> = {};
  const methods: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "function") {
      methods[key] = value;
    } else {
      config[key] = value;
    }
  }
  return { config, methods };
}

/**
 * Declares the API registry in a single call — the config-file entry point.
 *
 * Registers every API entry you list and returns them alongside the methods
 * declared on the same literal, so one `defineApiConfig` call is the whole setup:
 * no second registration step.
 *
 * Only object entries shaped like `{ baseUri, endpoints }` reach the registry;
 * boolean flags are kept on `config` for your own methods to read.
 *
 * @typeParam T - The literal passed in.
 * @param input - API entries, flags and methods in one object literal.
 * @returns The registered config plus the declared methods (see `ConfigFacade`).
 * @throws {Error} If a non-method value is an object that is not an API entry.
 *
 * @example
 * ```ts
 * import { defineApiConfig } from "katanakit-js/client";
 *
 * export default defineApiConfig({
 *   pokeapi: { baseUri: "https://pokeapi.co/api/v2", endpoints: { byId: "/pokemon/:id/" } },
 *   debug: true,
 *   getPokemon: async function () {
 *     return useFetch("pokeapi", "byId", { params: { id: 25 } });
 *   },
 * });
 * ```
 *
 * @remarks Methods must be written with `function`, not as arrows — `this.config`
 * is undefined inside an arrow function.
 */
export function defineApiConfig<T extends Record<string, unknown>>(
  input: T,
): { config: Record<string, unknown> } & Partial<T> {
  const { config, methods } = splitConfig(input);
  const registered: Record<string, ApiEntry> = {};
  for (const [name, value] of Object.entries(config)) {
    if (isApiEntry(value)) {
      registered[name] = value;
      continue;
    }
    if (typeof value === "object" && value !== null) {
      throw new Error(
        `[FetchApiManager] defineApiConfig: "${name}" is not an API entry ` +
          `(expected an object with baseUri and endpoints).`,
      );
    }
  }
  FetchApiManager.getInstance().useInit(registered);
  return { config, ...methods } as { config: Record<string, unknown> } & Partial<T>;
}

/**
 * Registers a request interceptor on the singleton HTTP client.
 *
 * @param interceptor - The function to run before the request is sent.
 * @returns A function that unregisters the interceptor.
 */
export function useAddRequestInterceptor(interceptor: RequestInterceptor): () => void {
  return FetchApiManager.getInstance().useAddRequestInterceptor(interceptor);
}

/**
 * Returns a shallow copy of the registered APIs.
 *
 * @returns A shallow copy of the current API registry.
 *
 * @example
 * ```ts
 * import { useGetApis } from "katanakit-js/client";
 * const apis = useGetApis();
 * ```
 */
export function useGetApis(): ApisConfig {
  return FetchApiManager.getInstance().useGetApis();
}

/**
 * Returns a shallow copy of the registered APIs. Alias for
 * {@link useGetApis}.
 *
 * @returns A shallow copy of the current API registry.
 */
export function useGetApisConfig(): ApisConfig {
  return FetchApiManager.getInstance().useGetApisConfig();
}

/**
 * Returns the URL of a registered endpoint **without calling `fetch`**.
 *
 * @param apiName - Registered API key (from `defineApiConfig`).
 * @param endpointName - Endpoint key inside that API.
 * @param options - `params` fills `:placeholders`, `query` becomes the search string.
 * @returns The fully built URL.
 *
 * @example
 * ```ts
 * import { useBuildUrl } from "katanakit-js/client";
 * useBuildUrl("pokeapi", "pokemonById", { params: { id: 25 } });
 * // → "https://pokeapi.co/api/v2/pokemon/25"
 * ```
 */
export function useBuildUrl(
  apiName: string,
  endpointName: string,
  options?: UrlOptions,
): string {
  return FetchApiManager.getInstance().useBuildUrl(apiName, endpointName, options);
}

/**
 * Fetches a registered endpoint and returns a Safe Result.
 *
 * @param apiName - The registered API key.
 * @param endpointName - The endpoint key within the API.
 * @param options - Fetch options.
 * @returns A `FetchResult` with data or error. Never throws.
 *
 * @example
 * ```ts
 * import { useFetch } from "katanakit-js/client";
 * const result = await useFetch("pokeapi", "pokemonById", { params: { id: 25 } });
 * if (result.ok) console.log(result.data);
 * ```
 */
export async function useFetch<T = unknown>(
  apiName: string,
  endpointName: string,
  options?: FetchOptions<T>,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().useFetch(apiName, endpointName, options);
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
 * import { useGet } from "katanakit-js/client";
 * const result = await useGet("pokeapi", "pokemonById", { params: { id: 25 } });
 * if (result.ok) console.log(result.data.name); // "pikachu"
 * ```
 */
export async function useGet<T = unknown>(
  apiName: string,
  endpointName: string,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().useGet(apiName, endpointName, urlOptions);
}

/**
 * GET helper over a registered API endpoint. Alias for {@link useGet}.
 *
 * @param apiName - The registered API key.
 * @param endpointName - The endpoint key within the API.
 * @param urlOptions - Optional URL building options.
 * @returns A `FetchResult` with data or error.
 */
export async function useGetApi<T = unknown>(
  apiName: string,
  endpointName: string,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().useGetApi(apiName, endpointName, urlOptions);
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
 * import { usePost } from "katanakit-js/client";
 * const result = await usePost("pokeapi", "createPokemon", { name: "Pikachu" });
 * if (result.ok) console.log(result.data.name); // "Pikachu"
 * ```
 */
export async function usePost<T = unknown>(
  apiName: string,
  endpointName: string,
  body?: unknown,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().usePost(apiName, endpointName, body, urlOptions);
}

/**
 * PUT helper over a registered API endpoint.
 *
 * @param apiName - The registered API key.
 * @param endpointName - The endpoint key within the API.
 * @param body - Optional request body (auto-serialized to JSON unless raw).
 * @param urlOptions - Optional URL building options.
 * @returns A `FetchResult` with data or error.
 */
export async function usePut<T = unknown>(
  apiName: string,
  endpointName: string,
  body?: unknown,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().usePut(apiName, endpointName, body, urlOptions);
}

/**
 * PATCH helper over a registered API endpoint.
 *
 * @param apiName - The registered API key.
 * @param endpointName - The endpoint key within the API.
 * @param body - Optional request body (auto-serialized to JSON unless raw).
 * @param urlOptions - Optional URL building options.
 * @returns A `FetchResult` with data or error.
 */
export async function usePatch<T = unknown>(
  apiName: string,
  endpointName: string,
  body?: unknown,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().usePatch(
    apiName,
    endpointName,
    body,
    urlOptions,
  );
}

/**
 * DELETE helper over a registered API endpoint.
 *
 * @param apiName - The registered API key.
 * @param endpointName - The endpoint key within the API.
 * @param urlOptions - Optional URL building options.
 * @returns A `FetchResult` with data or error.
 */
export async function useDelete<T = unknown>(
  apiName: string,
  endpointName: string,
  urlOptions?: UrlOptions,
): Promise<FetchResult<T>> {
  return FetchApiManager.getInstance().useDelete(apiName, endpointName, urlOptions);
}

export type {
  ApiEntry,
  ApisConfig,
  FetchOptions,
  FetchRequest,
  FetchResult,
  HttpMethod,
  PathParams,
  QueryParams,
  RequestInterceptor,
  SafeResult,
  UrlOptions,
} from "./types";
