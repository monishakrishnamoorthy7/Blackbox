import { prisma, isDatabaseReady, markDatabaseDown } from "../config/db.js";
import { ingestTelemetry, normalizeTelemetryPayload } from "./telemetryService.js";
import { accidentDetectionConfig } from "../config/accidentDetection.js";
import { createEvidenceId } from "./blockchain/blockchainService.js";
import { syncAccidentEvidence } from "./blockchain/blockchainSyncService.js";

const memoryAccidents = [];

function withId(row) {
  return { ...row, _id: row.id };
}

function isNotFound(error) {
  return error?.code === "P2025";
}

export async function updateAccidentState(accidentId, state, sosStatus = state) {
  if (!accidentId) return null;
  const patch = { state, sosStatus, ...(state === "CANCELLED" ? { cancelledAt: new Date() } : {}) };
  if (isDatabaseReady()) {
    try {
      const row = await prisma.accident.update({ where: { id: String(accidentId) }, data: patch });
      return withId(row);
    } catch (error) {
      if (!isNotFound(error)) markDatabaseDown(error);
    }
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
    try {
      const row = await prisma.accident.update({ where: { id: String(accidentId) }, data: metadata });
      return withId(row);
    } catch (error) {
      if (!isNotFound(error)) markDatabaseDown(error);
    }
  }
  const accident = memoryAccidents.find((item) => String(item._id) === String(accidentId));
  if (!accident) return null;
  Object.assign(accident, metadata, { updatedAt: new Date() });
  return accident;
}

export async function getAccidentAlert(accidentId) {
  if (isDatabaseReady()) {
    try {
      const row = await prisma.accident.findUnique({ where: { id: String(accidentId) } });
      if (row) return withId(row);
    } catch (error) {
      if (!isNotFound(error)) markDatabaseDown(error);
    }
  }
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

  let alert = null;
  if (isDatabaseReady()) {
    try {
      const row = await prisma.accident.create({ data: accidentPayload });
      alert = withId(row);
    } catch (error) {
      markDatabaseDown(error);
    }
  }
  if (!alert) {
    alert = {
      ...accidentPayload,
      _id: `memory-accident-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryAccidents.unshift(alert);
  }

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
  if (isDatabaseReady()) {
    try {
      const rows = await prisma.accident.findMany({
        where: deviceId ? { deviceId } : undefined,
        orderBy: { timestamp: "desc" },
        take: safeLimit,
      });
      return rows.map(withId);
    } catch (error) {
      markDatabaseDown(error);
    }
  }
  return memoryAccidents.filter((item) => !deviceId || item.deviceId === deviceId).slice(0, safeLimit);
}

function reportWhere({ deviceId, dateFrom, dateTo, status, severity, gpsStatus } = {}) {
  const where = {};
  if (deviceId) where.deviceId = deviceId;
  if (status) where.state = status;
  if (severity) where.severity = severity;
  if (gpsStatus) where.gpsStatus = gpsStatus;
  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) where.timestamp.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.timestamp.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  return where;
}

function matchesReportFilters(accident, { deviceId, dateFrom, dateTo, status, severity, gpsStatus } = {}) {
  if (deviceId && accident.deviceId !== deviceId) return false;
  if (status && accident.state !== status) return false;
  if (severity && accident.severity !== severity) return false;
  if (gpsStatus && accident.gpsStatus !== gpsStatus) return false;
  const timestamp = new Date(accident.timestamp).getTime();
  if (dateFrom && timestamp < new Date(`${dateFrom}T00:00:00.000Z`).getTime()) return false;
  if (dateTo && timestamp > new Date(`${dateTo}T23:59:59.999Z`).getTime()) return false;
  return true;
}

export async function listReportAccidents(filters = {}) {
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 1000, 1), 5000);
  if (isDatabaseReady()) {
    try {
      const rows = await prisma.accident.findMany({
        where: reportWhere(filters),
        orderBy: { timestamp: "desc" },
        take: safeLimit,
      });
      return rows.map(withId);
    } catch (error) {
      markDatabaseDown(error);
    }
  }
  return memoryAccidents.filter((accident) => matchesReportFilters(accident, filters)).slice(0, safeLimit);
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
