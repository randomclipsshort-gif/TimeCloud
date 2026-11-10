import express from "express";
import helmet from "helmet";
import { getServerConfig } from "./config/config.js";
import { getMongoDb } from "./config/mongodb.js";
import { getAuth } from "./services/auth.js";
import { apiRateLimit } from "./middleware/apiRateLimit.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createAuthController } from "./controllers/authController.js";
import { createApiRoutes } from "./routes/apiRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";

export function createApp({
  config = getServerConfig(),
  loadMongoDb = getMongoDb,
  loadAuth = getAuth,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(createCorsMiddleware(config.appOrigin));
  app.use("/health", createHealthRoutes({ loadMongoDb }));
  app.use("/api/health", createHealthRoutes({ loadMongoDb }));
  const authController = createAuthController({ loadAuth });
  app.all("/api/auth", authController);
  app.all("/api/auth/*", authController);
  app.use("/api", apiRateLimit);
  app.use("/api", express.json({ limit: "1100kb", strict: true }));
  app.use("/api", createApiRoutes({ loadMongoDb, loadAuth, config }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
