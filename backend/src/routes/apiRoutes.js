import { Router } from "express";
import { createApiController } from "../controllers/apiController.js";

export function createApiRoutes({ loadMongoDb, loadAuth, config }) {
  const router = Router();
  router.all("/*", createApiController({ loadMongoDb, loadAuth, config }));
  return router;
}
