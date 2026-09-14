import { Telemetry } from "../models/Telemetry.js";
import { isDatabaseReady } from "../config/db.js";
import { normalizeVibrationInput } from "../hardware/sw420.js";

const memoryTelemetry = [];
const MEMORY_LIMIT = 500;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeTelemetryPayload(body = {}) {
  const gps = body.gps || {};
  const vibration = normalizeVibrationInput(body.vibration);
  return {
    deviceId: String(body.deviceId || "").trim(),
    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    speed: finiteNumber(body.speed),
    acceleration: {
      x: finiteNumber(body.acceleration?.x ?? body.accelX),
      y: finiteNumber(body.acceleration?.y ?? body.accelY),
      z: finiteNumber(body.acceleration?.z ?? body.accelZ),
    },
    gyroscope: {
      x: finiteNumber(body.gyroscope?.x ?? body.gyroX),
      y: finiteNumber(body.gyroscope?.y ?? body.gyroY),
      z: finiteNumber(body.gyroscope?.z ?? body.gyroZ),
    },
    leanAngle: finiteNumber(body.leanAngle),
    temperature: finiteNumber(body.temperature),
    current: finiteNumber(body.current),
    gps: {
      latitude: gps.latitude == null ? body.latitude ?? null : finiteNumber(gps.latitude, null),
      longitude: gps.longitude == null ? body.longitude ?? null : finiteNumber(gps.longitude, null),
      speed: finiteNumber(gps.speed ?? body.gpsSpeed),
      course: finiteNumber(gps.course ?? body.gpsCourse),
      status: gps.status ?? body.gpsStatus ?? "nofix",
    },
    networkStatus: body.networkStatus ?? "unknown",
    accidentStatus: body.accidentStatus ?? "normal",
    ...(vibration === undefined ? {} : { vibration }),
  };
}

export async function ingestTelemetry(payload, io) {
  let doc;
  if (isDatabaseReady()) {
    doc = await Telemetry.create(payload);
  } else {
    doc = {
      ...payload,
      _id: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryTelemetry.unshift(doc);
    memoryTelemetry.splice(MEMORY_LIMIT);
  }
  io?.emit("telemetry:update", doc);
  return doc;
}

export async function listTelemetry({ deviceId, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  if (!isDatabaseReady()) {
    return memoryTelemetry.filter((item) => !deviceId || item.deviceId === deviceId).slice(0, safeLimit);
  }

  const query = deviceId ? { deviceId } : {};
  return Telemetry.find(query).sort({ timestamp: -1 }).limit(safeLimit).lean();
}

export async function latestTelemetry(deviceId) {
  if (!isDatabaseReady()) {
    return memoryTelemetry.find((item) => !deviceId || item.deviceId === deviceId) || null;
  }

  const query = deviceId ? { deviceId } : {};
  return Telemetry.findOne(query).sort({ timestamp: -1 }).lean();
}
