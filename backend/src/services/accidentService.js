import { Accident } from "../models/Accident.js";
import { isDatabaseReady } from "../config/db.js";
import { ingestTelemetry, normalizeTelemetryPayload } from "./telemetryService.js";
import { accidentDetectionConfig } from "../config/accidentDetection.js";
import { createEvidenceId } from "./blockchain/blockchainService.js";
import { syncAccidentEvidence } from "./blockchain/blockchainSyncService.js";

const memoryAccidents = [];

export async function updateAccidentState(accidentId, state, sosStatus = state) {
  if (!accidentId) return null;
  if (isDatabaseReady()) {
    return Accident.findByIdAndUpdate(
      accidentId,
      { state, sosStatus, ...(state === "CANCELLED" ? { cancelledAt: new Date() } : {}) },
      { new: true }
    ).lean();
  }
  const accident = memoryAccidents.find((item) => String(item._id) === String(accidentId));
  if (!accident) return null;
  accident.state = state;
  accident.sosStatus = sosStatus;
  if (state === "CANCELLED") accident.cancelledAt = new Date();
  return accident;
}

export async function updateAccidentMetadata(accidentId, metadata) {
  if (!accidentId) return null;
  if (isDatabaseReady()) {
    return Accident.findByIdAndUpdate(accidentId, metadata, { new: true }).lean();
  }
  const accident = memoryAccidents.find((item) => String(item._id) === String(accidentId));
  if (!accident) return null;
  Object.assign(accident, metadata, { updatedAt: new Date() });
  return accident;
}

export async function getAccidentAlert(accidentId) {
  if (isDatabaseReady()) return Accident.findById(accidentId).lean();
  return memoryAccidents.find((item) => String(item._id) === String(accidentId)) || null;
}

export async function createAccidentAlert(body, io, options = {}) {
  let telemetry = null;
  if (options.telemetry) {
    telemetry = options.telemetry;
  } else if (body.deviceId && options.ingestTelemetry !== false) {
    const telemetryPayload = normalizeTelemetryPayload({
      ...body,
      accidentStatus: body.accidentStatus || "accident",
    });
    telemetry = await ingestTelemetry(telemetryPayload, io);
  }

  const accidentPayload = {
    deviceId: body.deviceId,
    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    telemetryId: telemetry?._id ?? null,
    latitude: body.gps?.latitude ?? body.latitude ?? telemetry?.gps?.latitude ?? null,
    longitude: body.gps?.longitude ?? body.longitude ?? telemetry?.gps?.longitude ?? null,
    speed: Number(body.speed ?? telemetry?.speed ?? 0),
    leanAngle: Number(body.leanAngle ?? telemetry?.leanAngle ?? 0),
    severity: body.severity || "high",
    status: "open",
    source: body.source || "simulator",
    message: body.message || "Accident alert",
    impact: Number(body.impact ?? body.impactValue ?? 0),
    speedBeforeImpact: Number(body.speedBeforeImpact ?? body.speed ?? telemetry?.speed ?? 0),
    speedAfterImpact: Number(body.speedAfterImpact ?? 0),
    speedBefore: Number(body.speedBefore ?? body.speedBeforeImpact ?? body.speed ?? telemetry?.speed ?? 0),
    speedAfter: Number(body.speedAfter ?? body.speedAfterImpact ?? 0),
    gpsStatus: body.gps?.status ?? body.gpsStatus ?? telemetry?.gps?.status ?? "nofix",
    temperature: Number(body.temperature ?? telemetry?.temperature ?? 0),
    current: Number(body.current ?? telemetry?.current ?? 0),
    vibration: body.vibration ?? telemetry?.vibration ?? false,
    accidentStatus: body.accidentStatus || "accident",
    state: body.state || "CONFIRMED",
    confidence: Number(body.confidence ?? 0),
    speedDrop: Number(body.speedDrop ?? 0),
    triggeredSignals: Array.isArray(body.triggeredSignals) ? body.triggeredSignals : [],
    acceleration: body.acceleration || telemetry?.acceleration || {},
    gyroscope: body.gyroscope || telemetry?.gyroscope || {},
    networkStatus: body.networkStatus ?? telemetry?.networkStatus ?? "unknown",
    sosStatus: body.sosStatus || "PENDING",
    evidenceId: body.evidenceId || createEvidenceId(),
    evidenceVersion: Number(body.evidenceVersion) || 1,
    blockchainStatus: body.blockchainStatus || "PENDING",
    evidenceHash: body.evidenceHash || null,
    blockchainReference: body.blockchainReference || null,
    blockchainRecordedAt: body.blockchainRecordedAt || null,
    blockchainError: body.blockchainError || null,
  };
  const alert = isDatabaseReady()
    ? await Accident.create(accidentPayload)
    : {
        ...accidentPayload,
        _id: `memory-accident-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  if (!isDatabaseReady()) memoryAccidents.unshift(alert);

  io?.emit("accident:alert", { alert, telemetry });
  io?.emit("accident:countdown", {
    ...alert,
    telemetry,
    state: "COUNTDOWN",
    seconds: accidentDetectionConfig.countdownSeconds,
  });
  void syncAccidentEvidence(alert, updateAccidentMetadata, io);
  return { alert, telemetry };
}

export async function listAccidentAlerts({ deviceId, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  if (!isDatabaseReady()) {
    return memoryAccidents.filter((item) => !deviceId || item.deviceId === deviceId).slice(0, safeLimit);
  }

  const query = deviceId ? { deviceId } : {};
  return Accident.find(query).sort({ timestamp: -1 }).limit(safeLimit).lean();
}

function reportQuery({ deviceId, dateFrom, dateTo, status, severity, gpsStatus } = {}) {
  const query = {};
  if (deviceId) query.deviceId = deviceId;
  if (status) query.state = status;
  if (severity) query.severity = severity;
  if (gpsStatus) query.gpsStatus = gpsStatus;
  if (dateFrom || dateTo) {
    query.timestamp = {};
    if (dateFrom) query.timestamp.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) query.timestamp.$lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  return query;
}

export async function listReportAccidents(filters = {}) {
  const query = reportQuery(filters);
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 1000, 1), 5000);
  if (!isDatabaseReady()) {
    return memoryAccidents.filter((accident) => {
      if (query.deviceId && accident.deviceId !== query.deviceId) return false;
      if (query.state && accident.state !== query.state) return false;
      if (query.severity && accident.severity !== query.severity) return false;
      if (query.gpsStatus && accident.gpsStatus !== query.gpsStatus) return false;
      const timestamp = new Date(accident.timestamp).getTime();
      if (query.timestamp?.$gte && timestamp < query.timestamp.$gte.getTime()) return false;
      if (query.timestamp?.$lte && timestamp > query.timestamp.$lte.getTime()) return false;
      return true;
    }).slice(0, safeLimit);
  }
  return Accident.find(query).sort({ timestamp: -1 }).limit(safeLimit).lean();
}

export async function summarizeReportAccidents(filters = {}) {
  const accidents = await listReportAccidents(filters);
  const total = accidents.length;
  const average = (field) => total ? accidents.reduce((sum, accident) => sum + Number(accident[field] || 0), 0) / total : 0;
  return {
    total,
    confirmed: accidents.filter((accident) => accident.state === "CONFIRMED").length,
    cancelled: accidents.filter((accident) => accident.state === "CANCELLED").length,
    sosTriggered: accidents.filter((accident) => accident.sosStatus === "SOS_TRIGGERED").length,
    averageImpact: average("impact"),
    averageSpeedBeforeImpact: average("speedBeforeImpact"),
    averageSpeedAfterImpact: average("speedAfterImpact"),
  };
}
