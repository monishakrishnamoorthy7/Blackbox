import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { isDatabaseReady } from "../src/config/db.js";
import { evaluateTelemetry, resetDetection } from "../src/services/accidentDetectionService.js";
import { createAccidentAlert } from "../src/services/accidentService.js";
import { getAccidentAlert, updateAccidentMetadata } from "../src/services/accidentService.js";
import { createEmergencyEvent } from "../src/services/emergencyService.js";
import { ingestTelemetry, normalizeTelemetryPayload } from "../src/services/telemetryService.js";

const deviceId = "BBX-TEST-001";
let server;
let io;
let baseUrl;

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
  });
  return { response, body: await response.json() };
}

function recordingIo() {
  const events = [];
  return {
    events,
    emit(event, payload) {
      events.push({ event, payload });
    },
  };
}

async function waitFor(check, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return check();
}

before(async () => {
  ({ server, io } = createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  io.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe("Bike Black Box API", () => {
  it("reports health while MongoDB is unavailable", async () => {
    assert.equal(isDatabaseReady(), false);
    const { response, body } = await request("/api/health");

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.database, "disconnected");
  });

  it("validates telemetry input and stores valid telemetry in memory", async () => {
    const missingDevice = await request("/api/telemetry", {
      method: "POST",
      body: JSON.stringify({ speed: 20 }),
    });
    assert.equal(missingDevice.response.status, 400);

    const invalidSpeed = await request("/api/telemetry", {
      method: "POST",
      body: JSON.stringify({ deviceId, speed: "fast" }),
    });
    assert.equal(invalidSpeed.response.status, 400);

    const invalidVibration = await request("/api/telemetry", {
      method: "POST",
      body: JSON.stringify({ deviceId, vibration: "detected" }),
    });
    assert.equal(invalidVibration.response.status, 400);

    const valid = await request("/api/telemetry", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        speed: 32.4,
        acceleration: { x: 0.2, y: 0.1, z: 9.8 },
        gps: { latitude: 12.9716, longitude: 77.5946, status: "fix" },
        vibration: false,
      }),
    });
    assert.equal(valid.response.status, 201);
    assert.equal(valid.body.data.deviceId, deviceId);

    const listed = await request(`/api/telemetry?deviceId=${deviceId}`);
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.count, 1);
    assert.equal(listed.body.data[0].gps.status, "fix");
    assert.equal(listed.body.data[0].vibration, false);
  });

  it("accepts vibration as a supporting signal but does not confirm it alone", () => {
    const vibrationDevice = "BBX-VIBRATION-001";
    resetDetection(vibrationDevice);
    const events = recordingIo();
    const result = evaluateTelemetry(normalizeTelemetryPayload({ deviceId: vibrationDevice, speed: 30, vibration: true }), events);
    assert.equal(result.state, "SUSPECTED");
    assert.deepEqual(result.triggeredSignals, ["VIBRATION"]);
    assert.equal(events.events.some(({ event }) => event === "accident:confirmed"), false);
  });

  it("creates and lists accident alerts using the memory fallback", async () => {
    const created = await request("/api/accidents", {
      method: "POST",
      body: JSON.stringify({ deviceId, speed: 11, leanAngle: 54, severity: "high" }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.alert.deviceId, deviceId);

    const listed = await request(`/api/accidents?deviceId=${deviceId}`);
    assert.equal(listed.response.status, 200);
    assert.ok(listed.body.data.some((alert) => alert.deviceId === deviceId));
  });

  it("filters report accidents and calculates report summaries", async () => {
    const reportDevice = "BBX-REPORT-001";
    await request("/api/accidents", {
      method: "POST",
      body: JSON.stringify({ deviceId: reportDevice, timestamp: "2026-09-04T10:00:00Z", impact: 20, speedBeforeImpact: 40, speedAfterImpact: 5, severity: "critical", gpsStatus: "fix", state: "CONFIRMED", sosStatus: "SOS_TRIGGERED" }),
    });
    await request("/api/accidents", {
      method: "POST",
      body: JSON.stringify({ deviceId: reportDevice, timestamp: "2026-09-05T10:00:00Z", impact: 10, speedBeforeImpact: 25, speedAfterImpact: 0, severity: "low", gpsStatus: "estimated", state: "CANCELLED", sosStatus: "CANCELLED" }),
    });

    const filtered = await request("/api/reports/accidents?deviceId=BBX-REPORT-001&severity=critical&gpsStatus=fix");
    assert.equal(filtered.response.status, 200);
    assert.equal(filtered.body.count, 1);
    assert.equal(filtered.body.data[0].impact, 20);

    const summary = await request("/api/reports/summary?deviceId=BBX-REPORT-001");
    assert.equal(summary.response.status, 200);
    assert.deepEqual(summary.body.data, {
      total: 2,
      confirmed: 1,
      cancelled: 1,
      sosTriggered: 1,
      averageImpact: 15,
      averageSpeedBeforeImpact: 32.5,
      averageSpeedAfterImpact: 2.5,
    });
  });

  it("records and verifies accident evidence without affecting the accident API", async () => {
    const created = await request("/api/accidents", {
      method: "POST",
      body: JSON.stringify({ deviceId: "BBX-EVIDENCE-001", speed: 18, impact: 17, severity: "critical" }),
    });
    const accident = created.body.data.alert;
    assert.equal(created.response.status, 201);
    assert.ok(accident.evidenceId);
    assert.equal(accident.blockchainStatus, "PENDING");

    const recorded = await waitFor(async () => {
      const result = await request(`/api/accidents/${accident._id}/blockchain`);
      return result.body.data.status === "RECORDED" ? result.body.data : null;
    });
    assert.equal(recorded.status, "RECORDED");
    assert.equal((await request("/api/blockchain/status")).body.data.ledger, "local");
    assert.equal((await request(`/api/accidents/${accident._id}/blockchain`)).body.data.algorithm, "SHA-256");
    const committedHash = recorded.evidenceHash;

    const verified = await request(`/api/accidents/${accident._id}/blockchain/verify`, { method: "POST" });
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.data.status, "VERIFIED");
    assert.equal(verified.body.data.match, true);

    await updateAccidentMetadata(accident._id, { confidence: 99 });
    const tampered = await request(`/api/accidents/${accident._id}/blockchain/verify`, { method: "POST" });
    assert.equal(tampered.body.data.status, "TAMPERED");
    assert.equal(tampered.body.data.match, false);
    assert.equal((await request(`/api/accidents/${accident._id}/blockchain`)).body.data.evidenceHash, committedHash);
    assert.equal((await getAccidentAlert(accident._id)).state, "CONFIRMED");
  });

  it("cancels an accident countdown and persists the cancelled state", async () => {
    const created = await request("/api/accidents", {
      method: "POST",
      body: JSON.stringify({ deviceId, speed: 8, leanAngle: 60 }),
    });
    const accidentId = created.body.data.alert._id;

    const cancelled = await request("/api/emergency/cancel", {
      method: "POST",
      body: JSON.stringify({ deviceId, accidentId }),
    });
    assert.equal(cancelled.response.status, 201);
    assert.equal(cancelled.body.data.state, "CANCELLED");

    const listed = await request(`/api/accidents?deviceId=${deviceId}`);
    assert.ok(listed.body.data.some((alert) => alert._id === accidentId && alert.state === "CANCELLED"));
  });

  it("persists automatic and manual SOS events", async () => {
    const sosDeviceId = "BBX-SOS-001";
    const automatic = await request("/api/emergency/sos", {
      method: "POST",
      body: JSON.stringify({ deviceId: sosDeviceId }),
    });
    assert.equal(automatic.response.status, 201);
    assert.equal(automatic.body.data.type, "ACCIDENT");
    assert.equal(automatic.body.data.state, "SOS_TRIGGERED");

    const manual = await request("/api/emergency/manual-sos", {
      method: "POST",
      body: JSON.stringify({ deviceId: sosDeviceId }),
    });
    assert.equal(manual.response.status, 201);
    assert.equal(manual.body.data.type, "MANUAL_SOS");

    const listed = await request(`/api/emergency?deviceId=${sosDeviceId}`);
    assert.equal(listed.body.count, 2);
  });
});

describe("Socket.IO event lifecycle", () => {
  it("emits every documented realtime event", async () => {
    const socket = recordingIo();
    const detectionDevice = "BBX-SOCKET-001";
    resetDetection(detectionDevice);

    const normal = normalizeTelemetryPayload({ deviceId: detectionDevice, speed: 40 });
    await ingestTelemetry(normal, socket);
    evaluateTelemetry(normal, socket);

    const impact = normalizeTelemetryPayload({
      deviceId: detectionDevice,
      speed: 20,
      acceleration: { x: 16, y: 0, z: 0 },
      gyroscope: { x: 36, y: 0, z: 0 },
      leanAngle: 40,
    });
    evaluateTelemetry(impact, socket);
    await createAccidentAlert({ deviceId: detectionDevice }, socket, {
      telemetry: impact,
      ingestTelemetry: false,
    });
    await createEmergencyEvent({ deviceId: detectionDevice }, socket, "ACCIDENT", "SOS_TRIGGERED");
    await createEmergencyEvent({ deviceId: detectionDevice }, socket, "MANUAL_SOS", "SOS_TRIGGERED");
    await createEmergencyEvent({ deviceId: detectionDevice }, socket, "ACCIDENT", "CANCELLED");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const eventNames = new Set(socket.events.map(({ event }) => event));
    assert.deepEqual(
      [...eventNames].sort(),
      [
        "accident:alert",
        "accident:cancelled",
        "accident:confirmed",
        "accident:countdown",
        "accident:blockchain-status",
        "accident:suspected",
        "emergency:manual",
        "emergency:sos",
        "telemetry:update",
      ].sort()
    );
  });
});