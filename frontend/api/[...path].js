const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "accept-encoding",
]);

function getRenderOrigin(env) {
  const configured = env.RENDER_API_URL?.trim();
  if (!configured) {
    throw new Error("RENDER_API_URL is not configured.");
  }
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("RENDER_API_URL must be an HTTPS origin.");
  }
  return url.origin;
}

function writeJsonError(response, status, code, message) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ error: { code, message } }));
}

export function createProxyHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(request, response) {
    let upstreamOrigin;
    try {
      upstreamOrigin = getRenderOrigin(env);
    } catch (error) {
      console.error("TimeCloud Render proxy is not configured.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      writeJsonError(
        response,
        503,
        "API_UNAVAILABLE",
        "The application API is not configured.",
      );
      return;
    }

    const headers = new Headers();
    for (const [name, rawValue] of Object.entries(request.headers)) {
      if (hopByHopHeaders.has(name.toLowerCase()) || rawValue === undefined) continue;
      const value = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue);
      headers.set(name, value);
    }

    const method = (request.method || "GET").toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    try {
      const requestPath = request.url || "/";
      const targetUrl = new URL(requestPath, upstreamOrigin);
      if (
        !requestPath.startsWith("/") ||
        requestPath.startsWith("//") ||
        targetUrl.origin !== upstreamOrigin
      ) {
        writeJsonError(response, 400, "INVALID_PROXY_PATH", "The API path is invalid.");
        return;
      }
      const upstreamResponse = await fetchImpl(targetUrl, {
        method,
        headers,
        body: hasBody ? request : undefined,
        ...(hasBody ? { duplex: "half" } : {}),
        redirect: "manual",
      });
      response.statusCode = upstreamResponse.status;
      for (const [name, value] of upstreamResponse.headers) {
        if (name.toLowerCase() === "set-cookie" || hopByHopHeaders.has(name.toLowerCase())) {
          continue;
        }
        response.setHeader(name, value);
      }
      const cookies = upstreamResponse.headers.getSetCookie?.() ?? [];
      if (cookies.length > 0) response.setHeader("Set-Cookie", cookies);
      const body = Buffer.from(await upstreamResponse.arrayBuffer());
      response.end(body);
    } catch (error) {
      console.error("TimeCloud Render API request failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      if (!response.headersSent) {
        writeJsonError(
          response,
          502,
          "API_UNAVAILABLE",
          "The application API could not be reached.",
        );
      } else {
        response.end();
      }
    }
  };
}

export default createProxyHandler();

export const config = {
  api: { bodyParser: false },
};
