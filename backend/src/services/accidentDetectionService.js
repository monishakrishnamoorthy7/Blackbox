import { accidentDetectionConfig as config } from "../config/accidentDetection.js";

const deviceStates = new Map();

function magnitude(vector = {}) {
  const x = Number(vector.x || 0);
  const y = Number(vector.y || 0);
  const z = Number(vector.z || 0);
  return Math.sqrt(x * x + y * y + z * z);
}

function assess(previous, telemetry) {
  const impact = magnitude(telemetry.acceleration);
  const rotation = magnitude(telemetry.gyroscope);
  const speedBefore = Number(previous?.speed || telemetry.speed || 0);
  const speedAfter = Number(telemetry.speed || 0);
  const speedDrop = Math.max(0, speedBefore - speedAfter);
  const speedDropRatio = speedBefore > 1 ? speedDrop / speedBefore : 0;
  const leanAngle = Math.abs(Number(telemetry.leanAngle || 0));
  const signals = [];

  if (impact >= config.impactThreshold) signals.push("IMPACT");
  if (rotation >= config.rotationThreshold) signals.push("ROTATION");
  if (speedDrop >= config.speedDropThreshold || speedDropRatio >= config.speedDropRatio) signals.push("SPEED_DROP");
  if (leanAngle >= config.leanAngleThreshold) signals.push("ABNORMAL_LEAN");
  if (telemetry.vibration === true) signals.push("VIBRATION");

  const primarySignals = signals.filter((signal) => signal !== "VIBRATION");
  const confidence = Math.min(100, Math.round((primarySignals.length / 4) * 100));
  const severity = confidence >= 75 || impact >= config.impactThreshold * 1.4 ? "critical" : confidence >= 50 ? "high" : "medium";
  return {
    deviceId: telemetry.deviceId,
    timestamp: telemetry.timestamp,
    confidence,
    severity,
    triggeredSignals: signals,
    impact: Number(impact.toFixed(2)),
    speedBefore: Number(speedBefore.toFixed(2)),
    speedAfter: Number(speedAfter.toFixed(2)),
    speedDrop: Number(speedDrop.toFixed(2)),
    leanAngle: Number(leanAngle.toFixed(2)),
    gyroscope: telemetry.gyroscope,
    acceleration: telemetry.acceleration,
    temperature: telemetry.temperature,
    current: telemetry.current,
    vibration: telemetry.vibration,
    gps: telemetry.gps,
    networkStatus: telemetry.networkStatus,
    telemetry,
  };
}

function emit(io, event, payload) {
  io?.emit(event, payload);
}

export function evaluateTelemetry(telemetry, io, onConfirmed) {
  if (!telemetry?.deviceId) return { state: "NORMAL", signals: [] };
  const current = deviceStates.get(telemetry.deviceId) || {
    state: "NORMAL",
    previous: null,
    suspectedAt: null,
    stationarySince: null,
    timer: null,
  };
  const assessment = assess(current.previous, telemetry);
  current.previous = telemetry;

  if (current.state === "CONFIRMED" && telemetry.accidentStatus === "normal" && assessment.triggeredSignals.length === 0) {
    current.state = "NORMAL";
    current.suspectedAt = null;
  }

  if (Number(telemetry.speed || 0) <= config.stationarySpeedThreshold) {
    current.stationarySince ||= Date.now();
  } else {
    current.stationarySince = null;
  }
  if (current.stationarySince && Date.now() - current.stationarySince >= config.stationaryDurationMs && !assessment.triggeredSignals.includes("POST_IMPACT_STATIONARY")) {
    assessment.triggeredSignals.push("POST_IMPACT_STATIONARY");
  }

  if (current.state === "NORMAL" && assessment.triggeredSignals.length > 0) {
    current.state = "SUSPECTED";
    current.suspectedAt = Date.now();
    emit(io, "accident:suspected", { ...assessment, state: "SUSPECTED" });
  }

  const primarySignalCount = assessment.triggeredSignals.filter((signal) => signal !== "VIBRATION").length;
  if (current.state === "SUSPECTED" && assessment.triggeredSignals.length >= config.requiredSignals && primarySignalCount >= 2) {
    current.state = "CONFIRMED";
    if (current.timer) clearTimeout(current.timer);
    current.timer = null;
    emit(io, "accident:confirmed", { ...assessment, state: "CONFIRMED" });
    Promise.resolve(onConfirmed?.({ ...assessment, state: "CONFIRMED" })).catch((error) => {
      console.error(`[ACCIDENT] Confirmation persistence failed: ${error.message}`);
    });
  } else if (current.state === "SUSPECTED" && current.suspectedAt && Date.now() - current.suspectedAt > config.confirmationWindowMs) {
    current.state = "NORMAL";
    current.suspectedAt = null;
  }

  deviceStates.set(telemetry.deviceId, current);
  return { ...assessment, state: current.state };
}

export function resetDetection(deviceId) {
  const state = deviceStates.get(deviceId);
  if (state?.timer) clearTimeout(state.timer);
  deviceStates.delete(deviceId);
}

export { config as accidentDetectionConfig };
