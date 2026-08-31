/**
 * Thin browser-side fetch helper for the JSON API. Unwraps the `{ data }`
 * success envelope and throws a readable Error carrying the API's error
 * message + code for failures, so form components can surface it directly.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiClientError(
      err.message ?? "Request failed",
      err.code ?? "unknown",
      res.status,
      err.details,
    );
  }
  return body?.data as T;
}
