/**
 * HTTP method types for API requests.
 */
export type HttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/**
 * Query parameter key-value pairs.
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Path parameter key-value pairs (for `:param` placeholders).
 */
export type PathParams = Record<string, string | number>;

/**
 * Options for URL building when calling API endpoints.
 *
 * @param params - Path params to fill `:placeholders` in the endpoint.
 * @param query - Query-string params appended to the URL.
 * @param ignoreDefaultQuery - When `true`, skips the endpoint's
 *   `defaultQueryParams` instead of merging them.
 */
export interface UrlOptions {
  /** Path params substituted into `:name` placeholders of the endpoint. */
  params?: PathParams;
  /** Query-string params appended to the URL. */
  query?: QueryParams;
  /** Skip the endpoint's `defaultQueryParams` instead of merging them. */
  ignoreDefaultQuery?: boolean;
}

/**
 * Shape of a single registered API entry.
 *
 * Each API must have a `baseUri` (the root URL) and an `endpoints` map
 * (endpoint name → relative path). `defaultQueryParams` are optional
 * per-endpoint defaults that get merged into the query string.
 */
export interface ApiEntry {
  /** Root URL for the API (e.g. "https://pokeapi.co/api/v2"). */
  baseUri: string | URL;
  /** Mapping of endpoint names to relative paths. */
  endpoints: Record<string, string>;
  /** Optional default query params per endpoint. */
  defaultQueryParams?: Record<string, QueryParams>;
}

/**
 * Configuration of all registered APIs.
 *
 * A record where keys are API names and values are {@link ApiEntry} objects.
 */
export type ApisConfig = Record<string, ApiEntry>;

/**
 * Fetch request options.
 *
 * Extends the native `RequestInit` with additional fields for URL building:
 * - `params`: path parameters to fill `:placeholders`
 * - `query`: query string parameters
 * - `ignoreDefaultQuery`: whether to skip endpoint defaults
 * - `transform`: a function to transform the parsed response body
 *
 * @typeParam T - The type that `transform` resolves to. Defaults to `unknown`.
 */
export interface FetchOptions<T = unknown> extends RequestInit {
  /** Path params substituted into `:name` placeholders of the endpoint. */
  params?: PathParams;
  /** Query-string params appended to the URL. */
  query?: QueryParams;
  /** Skip the endpoint's `defaultQueryParams` instead of merging them. */
  ignoreDefaultQuery?: boolean;
  /** Maps the parsed response body to `T` before it is returned. */
  transform?: (input: unknown) => T | Promise<T>;
}

/**
 * Structure of the safe error returned on non-2xx or network failures.
 */
export interface ApiError {
  /** Human-readable error message. */
  message: string;
  /** HTTP status code, or `0` for network errors. */
  status: number;
  /** Optional additional error details (response body, etc.). */
  details?: unknown;
}

/**
 * Generic Safe Result discriminated union (Astro Actions style).
 *
 * The `ok` flag narrows the union between the success and error branches
 * and nothing is thrown. Used as the return type for all API helpers.
 *
 * @typeParam T - The type of the successful data.
 * @typeParam E - The error type; defaults to {@link ApiError}.
 */
export type SafeResult<T, E = ApiError> =
  { data: T; error: null; ok: true } | { data: null; error: E; ok: false };

/**
 * Fetch result extending SafeResult with `url` and `status` fields.
 *
 * @typeParam T - The type of the successful data.
 */
export type FetchResult<T = unknown> = SafeResult<T, ApiError> & {
  /** The URL that was fetched. */
  url: string;
  /** The HTTP status code of the response. */
  status: number;
};

/**
 * Mutable request inputs passed through registered HTTP request interceptors.
 */
export interface FetchRequest {
  /** The full URL that will be fetched. */
  url: string;
  /** The request init options to pass to `fetch()`. */
  init: RequestInit;
}

/**
 * Inspects or modifies a request before `fetch`; interceptors run in
 * registration order.
 *
 * @param request - The mutable request to inspect or modify.
 * @returns The interceptor runs synchronously or returns a promise.
 */
export type RequestInterceptor = (request: FetchRequest) => void | Promise<void>;

/**
 * Contract of the fetch facade — the minimal surface area needed to
 * interact with the registered API registry.
 *
 * All methods return a `FetchResult` (never throw); callers narrow on
 * `result.ok` to access `result.data`.
 */
export interface IFetchApiManager {
  /** Returns a shallow copy of the registered APIs (safe to mutate locally). */
  useGetApis(): ApisConfig;
  /** Alias for {@link useGetApis}. */
  useGetApisConfig(): ApisConfig;
  /** Returns the URL of a registered endpoint **without calling `fetch`**. */
  useBuildUrl(apiName: string, endpointName: string, options?: UrlOptions): string;
  /** Registers a request interceptor, which runs before `fetch` on every request. */
  useAddRequestInterceptor(interceptor: RequestInterceptor): () => void;
  /** Fetches a registered endpoint and returns a Safe Result. */
  useFetch<T = unknown>(
    apiName: string,
    endpointName: string,
    options?: FetchOptions<T>,
  ): Promise<FetchResult<T>>;
  /** GET helper over a registered API endpoint. */
  useGet<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
  /** GET helper alias for {@link useGet}. */
  useGetApi<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
  /** POST helper over a registered API endpoint. */
  usePost<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
  /** PUT helper over a registered API endpoint. */
  usePut<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
  /** PATCH helper over a registered API endpoint. */
  usePatch<T = unknown>(
    apiName: string,
    endpointName: string,
    body?: unknown,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
  /** DELETE helper over a registered API endpoint. */
  useDelete<T = unknown>(
    apiName: string,
    endpointName: string,
    urlOptions?: UrlOptions,
  ): Promise<FetchResult<T>>;
}

/**
 * A method declared inline in a `define*Config` literal.
 *
 * Written with `function` (never an arrow) so `this` resolves to the facade.
 */
export type ConfigMethod = (...args: never[]) => unknown;

/**
 * Keys of `T` whose value is a {@link ConfigMethod}. Methods declared as
 * optional are still detected (`NonNullable`), so they are split out of the
 * config half rather than leaking into it.
 */
export type ConfigMethodKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends ConfigMethod ? K : never;
}[keyof T];

/**
 * The props/booleans half of a `define*Config` literal — the config data.
 */
export type ConfigData<T> = Omit<T, ConfigMethodKeys<T>>;

/**
 * The methods half of a `define*Config` literal.
 */
export type ConfigMethodEntries<T> = Pick<T, ConfigMethodKeys<T>>;

/**
 * What every `define*Config` returns: the registered config under `config`,
 * plus the methods declared alongside it so `this.config` resolves inside them.
 *
 * @typeParam T - The literal passed to the `define*Config` call.
 */
export type ConfigFacade<T> = {
  /** Props and booleans declared in the literal (methods stripped out). */
  config: ConfigData<T>;
} & ConfigMethodEntries<T>;

/**
 * Values accepted by `define*Config`: an {@link ApiEntry}, a boolean flag
 * (kept on `config` only — never registered as an API) or a method.
 */
export type ApiConfigValue = ApiEntry | boolean | ConfigMethod;

/**
 * Constraints every non-method entry of a `define*Config` literal must satisfy.
 *
 * @typeParam T - The literal being validated.
 * @typeParam V - The type every non-method value must satisfy.
 */
export type ConfigValues<T, V> = {
  [K in keyof T]: K extends ConfigMethodKeys<T> ? T[K] : V;
};
