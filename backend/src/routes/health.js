import { Router } from "express";
import { getHealth, getStatus, getSettings } from "../controllers/healthController.js";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
healthRouter.get("/status", getStatus);
healthRouter.get("/settings", getSettings);
