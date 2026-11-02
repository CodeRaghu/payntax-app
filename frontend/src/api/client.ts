/**
 * The only place the UI talks HTTP. Screens use the hooks in src/api/hooks, never fetch() directly.
 *
 * - Types come from contract/openapi.yaml (`npm run api:generate`), so a backend change that breaks the
 *   contract fails `tsc`, and `make contract-check` fails CI.
 * - Requests go to same-origin /api; Next.js proxies them to the backend (next.config.ts), or MSW answers
 *   them when NEXT_PUBLIC_API_MOCKING=enabled. The UI can't tell the difference.
 */
import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";

/** Every API error has this shape (apps/core/exceptions.py). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

const csrf: Middleware = {
  onRequest({ request }) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const token = readCookie("csrftoken");
      if (token) request.headers.set("X-CSRFToken", decodeURIComponent(token));
    }
    return request;
  },
};

// Same origin in the browser; an absolute origin keeps Request() happy in tests and on the server.
const baseUrl = typeof window === "undefined" ? "" : window.location.origin;

// Resolve fetch per call (not at import) so test and mock interceptors are always honoured.
export const api = createClient<paths>({ baseUrl, credentials: "same-origin", fetch: (request) => globalThis.fetch(request) });
api.use(csrf);

type Result<T> = { data?: T; error?: unknown; response: Response };

function toApiError(error: unknown, response: Response): ApiError {
  const body = (error ?? {}) as { detail?: string; errors?: Record<string, string[] | string> };
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body.errors ?? {})) {
    fieldErrors[key] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  const fallback = response.status >= 500 ? "Something went wrong on our side. Try again." : "Request failed.";
  return new ApiError(response.status, body.detail ?? fallback, fieldErrors);
}

/** Unwrap an openapi-fetch result: return data or throw ApiError. */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) throw toApiError(error, response);
  return data as T;
}
