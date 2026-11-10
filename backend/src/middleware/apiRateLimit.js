import { rateLimit } from "express-rate-limit";

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
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
