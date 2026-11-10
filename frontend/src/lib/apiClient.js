export class ApiClientError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status ?? 0;
    this.code = code ?? "NETWORK_ERROR";
  }
}

const configuredApiOrigin =
  import.meta.env?.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || "";

export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("API requests require an absolute same-origin path.");
  }

  let response;
  try {
    response = await fetch(`${configuredApiOrigin}/api${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiClientError(
      "The server could not be reached. Check your connection and try again.",
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      "The server returned an invalid response.",
      { status: response.status, code: "INVALID_RESPONSE" },
    );
  }

  if (!response.ok) {
    throw new ApiClientError(
      payload?.error?.message || "The request could not be completed.",
      {
        status: response.status,
        code: payload?.error?.code || "REQUEST_FAILED",
      },
    );
  }
  if (!Object.hasOwn(payload || {}, "data")) {
    throw new ApiClientError(
      "The server response did not contain data.",
      { status: response.status, code: "INVALID_RESPONSE" },
    );
  }
  return payload.data;
}