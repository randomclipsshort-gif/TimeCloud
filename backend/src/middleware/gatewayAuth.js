import {
  CLIENT_IP_HEADER,
  GATEWAY_SECRET_HEADER,
  gatewaySecretsMatch,
  getGatewaySecretBytes,
  isValidCanonicalClientIp,
} from "../config/gateway.js";

function writeGatewayError(response, status, code, message) {
  response
    .status(status)
    .set("Cache-Control", "no-store")
    .json({ error: { code, message } });
}

export function createGatewayMiddleware({
  env = process.env,
  isProduction = false,
} = {}) {
  const production = isProduction || env.NODE_ENV === "production";
  const expectedSecret = getGatewaySecretBytes(env.TIMECLOUD_GATEWAY_SECRET);

  return function gatewayMiddleware(request, response, next) {
    const isApiRequest =
      request.path === "/api" || request.path.startsWith("/api/");
    const suppliedSecret = request.headers[GATEWAY_SECRET_HEADER];
    const suppliedClientIp = request.headers[CLIENT_IP_HEADER];

    delete request.headers[GATEWAY_SECRET_HEADER];
    delete request.headers[CLIENT_IP_HEADER];
    delete request.headers["x-forwarded-for"];
    delete request.headers["x-real-ip"];
    delete request.headers["x-vercel-forwarded-for"];

    if (!isApiRequest || !production) {
      return next();
    }

    if (!expectedSecret) {
      return writeGatewayError(
        response,
        503,
        "API_UNAVAILABLE",
        "The application API is not configured.",
      );
    }

    if (!gatewaySecretsMatch(expectedSecret, suppliedSecret)) {
      return writeGatewayError(
        response,
        401,
        "GATEWAY_AUTH_REQUIRED",
        "Gateway authentication is required.",
      );
    }

    if (!isValidCanonicalClientIp(suppliedClientIp)) {
      return writeGatewayError(
        response,
        400,
        "INVALID_CLIENT_IP",
        "The client address could not be verified.",
      );
    }

    request.headers[CLIENT_IP_HEADER] = suppliedClientIp;
    return next();
  };
}