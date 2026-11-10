import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";

export function createHealthRoutes(dependencies) {
  const router = Router();
  const healthController = createHealthController(dependencies);
  router.get("/", healthController);
  return router;
}
