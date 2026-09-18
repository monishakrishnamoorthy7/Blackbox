import { Router } from "express";
import { getAccidentAlerts, postAccidentAlert } from "../controllers/accidentController.js";
import { requireDeviceId } from "../middleware/index.js";

export const accidentRouter = Router();

accidentRouter.post("/accidents", requireDeviceId, postAccidentAlert);
accidentRouter.get("/accidents", getAccidentAlerts);
