import { Router } from "express";
import { healthRouter } from "./health.js";
import { telemetryRouter } from "./telemetry.js";
import { accidentRouter } from "./accident.js";
import { emergencyRouter } from "./emergency.js";
import { blockchainRouter } from "./blockchain.js";
import { reportRouter } from "./report.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(telemetryRouter);
apiRouter.use(accidentRouter);
apiRouter.use(emergencyRouter);
apiRouter.use(blockchainRouter);
apiRouter.use(reportRouter);
