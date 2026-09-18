import { Emergency } from "../models/Emergency.js";
import { isDatabaseReady } from "../config/db.js";
import { latestTelemetry } from "./telemetryService.js";
import { updateAccidentState } from "./accidentService.js";

const memoryEmergencies = [];

export async function sendEmergencySOS(emergencyData) {
  console.log(`[A7670C SIMULATION] SOS would be sent for ${emergencyData.deviceId}`);
  return { simulated: true, provider: "A7670C", sentAt: new Date().toISOString() };
}

async function persistEmergency(payload) {
  if (isDatabaseReady()) return Emergency.create(payload);
  const event = { ...payload, _id: `memory-emergency-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
  memoryEmergencies.unshift(event);
  memoryEmergencies.splice(200);
  return event;
}

export async function createEmergencyEvent(body, io, type, state) {
  const telemetry = body.telemetry || await latestTelemetry(body.deviceId);
  const gps = body.gps || telemetry?.gps || {};
  const payload = {
    deviceId: body.deviceId || telemetry?.deviceId,
    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    type,
    state,
    accidentId: body.accidentId || body._id || null,
    severity: body.severity || "high",
    confidence: Number(body.confidence || 0),
    latitude: gps.latitude ?? null,
    longitude: gps.longitude ?? null,
    gpsStatus: gps.status || body.gpsStatus || "nofix",
    speed: Number(body.speed ?? telemetry?.speed ?? 0),
    speedBefore: Number(body.speedBefore ?? body.speedBeforeImpact ?? telemetry?.speed ?? 0),
    speedAfter: Number(body.speedAfter ?? body.speedAfterImpact ?? body.speed ?? telemetry?.speed ?? 0),
    speedDrop: Number(body.speedDrop || 0),
    impact: Number(body.impact || 0),
    leanAngle: Number(body.leanAngle ?? telemetry?.leanAngle ?? 0),
    temperature: Number(body.temperature ?? telemetry?.temperature ?? 0),
    current: Number(body.current ?? telemetry?.current ?? 0),
    triggeredSignals: Array.isArray(body.triggeredSignals) ? body.triggeredSignals : [],
    acceleration: body.acceleration || telemetry?.acceleration || {},
    gyroscope: body.gyroscope || telemetry?.gyroscope || {},
    networkStatus: body.networkStatus || telemetry?.networkStatus || "unknown",
    cancelledAt: state === "CANCELLED" ? new Date() : null,
    smsSimulation: true,
  };
  const event = await persistEmergency(payload);
  await updateAccidentState(payload.accidentId, state, state);
  if (state === "SOS_TRIGGERED") await sendEmergencySOS(event);
  if (state === "CANCELLED") io?.emit("accident:cancelled", event);
  else io?.emit(type === "MANUAL_SOS" ? "emergency:manual" : "emergency:sos", event);
  return event;
}

export async function listEmergencyEvents({ deviceId, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  if (!isDatabaseReady()) return memoryEmergencies.filter((item) => !deviceId || item.deviceId === deviceId).slice(0, safeLimit);
  return Emergency.find(deviceId ? { deviceId } : {}).sort({ timestamp: -1 }).limit(safeLimit).lean();
}