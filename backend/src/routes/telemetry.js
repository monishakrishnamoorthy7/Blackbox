import { Router } from "express";
import {
  getLatestTelemetry,
  getTelemetry,
  postTelemetry,
} from "../controllers/telemetryController.js";
import { requireDeviceId, validateTelemetry } from "../middleware/index.js";

export const telemetryRouter = Router();

telemetryRouter.post("/telemetry", requireDeviceId, validateTelemetry, postTelemetry);
telemetryRouter.get("/telemetry", getTelemetry);
telemetryRouter.get("/telemetry/latest", getLatestTelemetry);
