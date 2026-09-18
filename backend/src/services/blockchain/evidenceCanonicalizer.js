import { createHash } from "node:crypto";

export const EVIDENCE_VERSION = 1;

const evidenceFields = [
  "evidenceVersion",
  "evidenceId",
  "deviceId",
  "timestamp",
  "telemetryId",
  "severity",
  "confidence",
  "impact",
  "speedBeforeImpact",
  "speedAfterImpact",
  "speedDrop",
  "leanAngle",
  "acceleration",
  "gyroscope",
  "temperature",
  "current",
  "vibration",
  "gpsStatus",
  "networkStatus",
  "triggeredSignals",
  "accidentStatus",
  "source",
];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isoTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function vector(value = {}) {
  return {
    x: finiteNumber(value?.x),
    y: finiteNumber(value?.y),
    z: finiteNumber(value?.z),
  };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortKeys(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function createEvidenceSnapshot(accident = {}) {
  const snapshot = {
    evidenceVersion: Number(accident.evidenceVersion) || EVIDENCE_VERSION,
    evidenceId: accident.evidenceId || null,
    deviceId: accident.deviceId || null,
    timestamp: isoTimestamp(accident.timestamp),
    telemetryId: accident.telemetryId ? String(accident.telemetryId) : null,
    severity: accident.severity || null,
    confidence: finiteNumber(accident.confidence),
    impact: finiteNumber(accident.impact),
    speedBeforeImpact: finiteNumber(accident.speedBeforeImpact),
    speedAfterImpact: finiteNumber(accident.speedAfterImpact),
    speedDrop: finiteNumber(accident.speedDrop),
    leanAngle: finiteNumber(accident.leanAngle),
    acceleration: vector(accident.acceleration),
    gyroscope: vector(accident.gyroscope),
    temperature: finiteNumber(accident.temperature),
    current: finiteNumber(accident.current),
    vibration: accident.vibration === true,
    gpsStatus: accident.gpsStatus || null,
    networkStatus: accident.networkStatus || null,
    triggeredSignals: Array.isArray(accident.triggeredSignals) ? [...accident.triggeredSignals].map(String).sort() : [],
    accidentStatus: accident.accidentStatus || null,
    source: accident.source || null,
  };
  return Object.fromEntries(evidenceFields.map((field) => [field, snapshot[field]]));
}

export function canonicalizeEvidence(accident) {
  return JSON.stringify(sortKeys(createEvidenceSnapshot(accident)));
}

export function hashEvidence(accident) {
  return createHash("sha256").update(canonicalizeEvidence(accident), "utf8").digest("hex");
}
