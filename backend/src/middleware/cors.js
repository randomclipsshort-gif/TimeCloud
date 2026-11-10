import { ApiError } from "../services/apiService.js";

export function createCorsMiddleware(appOrigin) {
  return function corsMiddleware(request, response, next) {
    const origin = request.get("origin");
    response.vary("Origin");
    if (origin && origin !== appOrigin) {
      if (request.method === "OPTIONS" || !["GET", "HEAD"].includes(request.method)) {
        next(new ApiError(403, "ORIGIN_REJECTED", "Cross-origin request rejected."));
        return;
      }
      next();
      return;
    }

    if (origin === appOrigin) {
      response.set("Access-Control-Allow-Origin", appOrigin);
      response.set("Access-Control-Allow-Credentials", "true");
    }
    if (request.method === "OPTIONS") {
      response.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
      response.set(
        "Access-Control-Allow-Headers",
        request.get("access-control-request-headers") || "Content-Type, Authorization",
      );
      response.set("Access-Control-Max-Age", "600");
      response.status(204).end();
      return;
    }
    next();
  };
}
