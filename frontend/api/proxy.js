import { isIP } from "node:net";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "content-encoding",
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
const gatewaySecretHeader = "x-timecloud-gateway-secret";
const clientIpHeader = "x-timecloud-client-ip";
const privateHeaders = new Set([gatewaySecretHeader, clientIpHeader]);
const gatewaySecretPattern = /^[a-f\d]{64}$/i;

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

function getGatewaySecret(env) {
  const secret = env.TIMECLOUD_GATEWAY_SECRET;
  return typeof secret === "string" && gatewaySecretPattern.test(secret)
    ? secret
    : null;
}

function getCanonicalClientIp(request) {
  const forwardedFor = request.headers?.["x-forwarded-for"];
  if (typeof forwardedFor !== "string") return null;
  const clientIp = forwardedFor.trim();
  return isIP(clientIp) ? clientIp : null;
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

    const gatewaySecret = getGatewaySecret(env);
    if (!gatewaySecret) {
      writeJsonError(
        response,
        503,
        "API_UNAVAILABLE",
        "The application API is not configured.",
      );
      return;
    }

    const clientIp = getCanonicalClientIp(request);
    if (!clientIp) {
      writeJsonError(
        response,
        502,
        "GATEWAY_IP_UNAVAILABLE",
        "The client address could not be verified.",
      );
      return;
    }

    const headers = new Headers();
    for (const [name, rawValue] of Object.entries(request.headers)) {
      if (hopByHopHeaders.has(name.toLowerCase()) || rawValue === undefined) continue;
      const value = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue);
      headers.set(name, value);
    }
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");
    headers.delete("x-vercel-forwarded-for");
    headers.delete(clientIpHeader);
    headers.delete(gatewaySecretHeader);
    headers.set(clientIpHeader, clientIp);
    headers.set(gatewaySecretHeader, gatewaySecret);
    headers.set("accept-encoding", "identity");

    const method = (request.method || "GET").toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    try {
      const requestUrl = new URL(request.url || "/", "http://localhost");
      const rewrittenPath = requestUrl.searchParams.get("__tc_path");
      const requestPath = rewrittenPath ?? requestUrl.pathname + requestUrl.search;
      const targetUrl = new URL(requestPath, upstreamOrigin);
      if (
        !requestPath.startsWith("/api/") ||
        requestPath.startsWith("//") ||
        targetUrl.origin !== upstreamOrigin ||
        !targetUrl.pathname.startsWith("/api/")
      ) {
        writeJsonError(response, 400, "INVALID_PROXY_PATH", "The API path is invalid.");
        return;
      }
      if (rewrittenPath !== null) {
        targetUrl.search = "";
        for (const [name, value] of requestUrl.searchParams) {
          if (name !== "__tc_path") targetUrl.searchParams.append(name, value);
        }
      }
      const upstreamResponse = await fetchImpl(targetUrl, {
        method,
        headers,
        body: hasBody ? request : undefined,
        ...(hasBody ? { duplex: "half" } : {}),
        redirect: "manual",
      });
      console.info("TimeCloud Render API response.", {
        status: upstreamResponse.status,
        path: targetUrl.pathname,
        contentType: upstreamResponse.headers.get("content-type"),
        contentEncoding: upstreamResponse.headers.get("content-encoding"),
      });
      response.statusCode = upstreamResponse.status;
      for (const [name, value] of upstreamResponse.headers) {
        const lowerName = name.toLowerCase();
        if (
          lowerName === "set-cookie" ||
          hopByHopHeaders.has(lowerName) ||
          privateHeaders.has(lowerName)
        ) {
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
