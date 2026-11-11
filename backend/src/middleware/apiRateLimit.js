import { isIP } from "node:net";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { CLIENT_IP_HEADER } from "../config/gateway.js";

export function createApiRateLimit({
  windowMs = 15 * 60 * 1000,
  limit = 300,
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => {
      const clientIp = request.headers[CLIENT_IP_HEADER];
      return ipKeyGenerator(
        typeof clientIp === "string" && isIP(clientIp) ? clientIp : "127.0.0.1",
        64,
      );
    },
    skip: (request) => request.path.startsWith("/auth/"),
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Wait a little and try again.",
        },
      });
    },
  });
}

export const apiRateLimit = createApiRateLimit();
