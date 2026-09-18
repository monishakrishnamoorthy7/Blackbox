import {
  ingestTelemetry,
  latestTelemetry,
  listTelemetry,
  normalizeTelemetryPayload,
} from "../services/telemetryService.js";
import { evaluateTelemetry } from "../services/accidentDetectionService.js";
import { createAccidentAlert } from "../services/accidentService.js";

export async function postTelemetry(req, res, next) {
  try {
    const payload = normalizeTelemetryPayload(req.body);
    const io = req.app.get("io");
    const doc = await ingestTelemetry(payload, io);
    evaluateTelemetry(doc, io, (assessment) => createAccidentAlert({
      ...assessment,
      gps: assessment.gps,
      accidentStatus: "accident",
      source: "sensor-verification",
      message: "Multi-sensor accident confirmed",
    }, io, { telemetry: doc, ingestTelemetry: false }));
    res.status(201).json({ ok: true, data: doc });
  } catch (error) {
    next(error);
  }
}

export async function getTelemetry(req, res, next) {
  try {
    const data = await listTelemetry({
      deviceId: req.query.deviceId,
      limit: req.query.limit,
    });
    res.json({ ok: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
}

export async function getLatestTelemetry(req, res, next) {
  try {
    const data = await latestTelemetry(req.query.deviceId);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}
