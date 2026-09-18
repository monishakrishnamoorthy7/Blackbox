import { Router } from "express";
import { requireDeviceId } from "../middleware/index.js";
import { getEmergencyEvents, postEmergencyCancel, postEmergencySOS, postManualSOS } from "../controllers/emergencyController.js";

export const emergencyRouter = Router();

emergencyRouter.get("/emergency", getEmergencyEvents);
emergencyRouter.post("/emergency/manual-sos", requireDeviceId, postManualSOS);
emergencyRouter.post("/emergency/sos", requireDeviceId, postEmergencySOS);
emergencyRouter.post("/emergency/cancel", requireDeviceId, postEmergencyCancel);