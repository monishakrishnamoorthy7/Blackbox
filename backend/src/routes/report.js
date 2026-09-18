import { Router } from "express";
import { getReportAccidents, getReportSummary } from "../controllers/reportController.js";

export const reportRouter = Router();

reportRouter.get("/reports/summary", getReportSummary);
reportRouter.get("/reports/accidents", getReportAccidents);