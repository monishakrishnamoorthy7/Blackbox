import { createEmergencyEvent, listEmergencyEvents } from "../services/emergencyService.js";
import { latestTelemetry } from "../services/telemetryService.js";

export async function postManualSOS(req, res, next) {
  try {
    const telemetry = await latestTelemetry(req.body.deviceId);
    const event = await createEmergencyEvent({ ...req.body, telemetry }, req.app.get("io"), "MANUAL_SOS", "SOS_TRIGGERED");
    res.status(201).json({ ok: true, data: event });
  } catch (error) {
    next(error);
  }
}

export async function postEmergencySOS(req, res, next) {
  try {
    const event = await createEmergencyEvent(req.body, req.app.get("io"), "ACCIDENT", "SOS_TRIGGERED");
    res.status(201).json({ ok: true, data: event });
  } catch (error) {
    next(error);
  }
}

export async function postEmergencyCancel(req, res, next) {
  try {
    const event = await createEmergencyEvent(req.body, req.app.get("io"), "ACCIDENT", "CANCELLED");
    res.status(201).json({ ok: true, data: event });
  } catch (error) {
    next(error);
  }
}

export async function getEmergencyEvents(req, res, next) {
  try {
    const data = await listEmergencyEvents({ deviceId: req.query.deviceId, limit: req.query.limit });
    res.json({ ok: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
}