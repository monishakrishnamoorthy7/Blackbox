import http from "http";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_URL = process.env.API_URL || "http://localhost:4000";
const DEVICE_ID = process.env.DEVICE_ID || "BBX-SIM-001";
const CONTROL_PORT = Number(process.env.CONTROL_PORT || 4100);
const INTERVAL_MS = 1000;
const START_LAT = Number(process.env.START_LAT || 13.0827);
const START_LNG = Number(process.env.START_LNG || 80.2707);

const state = {
  running: true,
  lat: START_LAT,
  lng: START_LNG,
  speed: 30,
  course: 72,
  tick: 0,
  gpsState: "fix",
  accidentPhase: null,
  accidentTick: 0,
  speedBeforeImpact: 0,
  busy: false,
  vibration: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function noise(amount) {
  return (Math.random() * 2 - 1) * amount;
}

function moveMotorcycle(speed, course) {
  const metersPerSecond = speed / 3.6;
  const radians = (course * Math.PI) / 180;
  state.lat += (Math.cos(radians) * metersPerSecond) / 111111;
  state.lng += (Math.sin(radians) * metersPerSecond) / (111111 * Math.cos((state.lat * Math.PI) / 180));
}

function gpsStatusForTick() {
  if (state.gpsState === "lost") return "estimated";
  if (state.gpsState === "restoring") {
    state.gpsState = "fix";
    console.log("[SIMULATOR] GPS restored");
    return "fix_restored";
  }
  return "fix";
}

function buildTelemetry() {
  state.tick += 1;
  const previousSpeed = state.speed;
  const cruisingSpeed = 29 + Math.sin(state.tick / 12) * 5 + noise(1.2);

  if (!state.accidentPhase) {
    state.speed += clamp(cruisingSpeed - state.speed, -2.4, 2.4);
    state.course = (state.course + Math.sin(state.tick / 20) * 1.5 + noise(1.2) + 360) % 360;
  } else {
    state.accidentTick += 1;
    const progress = state.accidentTick;
    state.speed = progress < 3 ? state.speed * (progress === 1 ? 0.78 : 0.58) : Math.max(0, state.speed * 0.35);
    state.course = (state.course + (progress < 3 ? 5 : -8) + 360) % 360;
  }

  moveMotorcycle(state.speed, state.course);
  const accident = state.accidentPhase;
  const impact = accident && state.accidentTick >= 2;
  state.vibration = Boolean(accident && state.accidentTick >= 2 && state.accidentTick <= 5);
  const acceleration = accident
    ? { x: 5.8 + noise(1.2), y: 7.2 + noise(1.4), z: 14.5 + noise(2.1) }
    : { x: noise(0.35), y: noise(0.3), z: 9.81 + noise(0.18) };
  const gyroscope = accident
    ? { x: 38 + noise(9), y: -27 + noise(8), z: 19 + noise(6) }
    : { x: noise(3), y: noise(2.5), z: noise(2) };
  const leanAngle = accident ? 42 + noise(8) : 7 + Math.sin(state.tick / 8) * 4 + noise(1.2);
  const gpsStatus = gpsStatusForTick();

  return {
    deviceId: DEVICE_ID,
    timestamp: new Date().toISOString(),
    speed: Number(state.speed.toFixed(2)),
    acceleration: Object.fromEntries(Object.entries(acceleration).map(([key, value]) => [key, Number(value.toFixed(3))])),
    gyroscope: Object.fromEntries(Object.entries(gyroscope).map(([key, value]) => [key, Number(value.toFixed(3))])),
    leanAngle: Number(leanAngle.toFixed(2)),
    temperature: Number((36.5 + Math.sin(state.tick / 30) * 1.8 + noise(0.25)).toFixed(2)),
    current: Number((1.7 + state.speed / 90 + noise(0.08)).toFixed(2)),
    gps: {
      latitude: Number(state.lat.toFixed(6)),
      longitude: Number(state.lng.toFixed(6)),
      speed: Number(state.speed.toFixed(2)),
      course: Number(state.course.toFixed(1)),
      status: gpsStatus,
    },
    networkStatus: "online",
    vibration: state.vibration,
    accidentStatus: accident ? (state.accidentTick >= 3 ? "accident" : "warning") : "normal",
    _speedBeforeTick: previousSpeed,
    _impact: impact ? Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2) : 0,
  };
}

async function postJson(pathname, body) {
  const response = await fetch(`${API_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${json.error || response.statusText}`);
  return json;
}

async function sendTick() {
  if (state.busy || !state.running) return;
  state.busy = true;
  try {
    const payload = buildTelemetry();
    const { _impact, _speedBeforeTick, ...publicPayload } = payload;
    await postJson("/api/telemetry", publicPayload);
    console.log(`[SIMULATOR] Telemetry sent speed=${publicPayload.speed} gps=${publicPayload.gps.status} vibration=${publicPayload.vibration ? "detected" : "normal"} status=${publicPayload.accidentStatus}`);

    if (state.accidentPhase && state.accidentTick === 1) console.log("[SIMULATOR] Accident suspected");
    if (state.accidentPhase && state.accidentTick === 3) console.log("[SIMULATOR] Confirmation telemetry sent to backend detector");
    if (state.accidentPhase && state.accidentTick >= 6) {
      state.accidentPhase = null;
      state.accidentTick = 0;
      console.log("[SIMULATOR] Accident sequence complete");
    }
  } catch (error) {
    console.error(`[SIMULATOR] Send failed: ${error.message}`);
  } finally {
    state.busy = false;
  }
}

function triggerAccident() {
  if (state.accidentPhase) return false;
  state.speedBeforeImpact = state.speed;
  state.accidentPhase = "active";
  state.accidentTick = 0;
  console.log("[SIMULATOR] Accident simulation started");
  return true;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  response.end(JSON.stringify(body));
}

const controlServer = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type" });
    return response.end();
  }
  if (request.method === "GET" && request.url === "/control/status") return sendJson(response, 200, { ok: true, data: { ...state, deviceId: DEVICE_ID, apiUrl: API_URL } });
  if (request.method !== "POST") return sendJson(response, 404, { ok: false, error: "Not found" });
  if (request.url === "/control/start") state.running = true;
  else if (request.url === "/control/stop") state.running = false;
  else if (request.url === "/control/accident") triggerAccident();
  else if (request.url === "/control/gps-lost") {
    state.gpsState = "lost";
    console.log("[SIMULATOR] GPS lost");
  } else if (request.url === "/control/gps-restore") {
    state.gpsState = "restoring";
  } else return sendJson(response, 404, { ok: false, error: "Unknown control" });
  sendJson(response, 200, { ok: true, data: { running: state.running, gpsState: state.gpsState, accident: Boolean(state.accidentPhase) } });
});

controlServer.listen(CONTROL_PORT, () => {
  console.log(`[SIMULATOR] Control API listening on http://localhost:${CONTROL_PORT}`);
  console.log(`[SIMULATOR] Sending telemetry to ${API_URL} every ${INTERVAL_MS}ms as ${DEVICE_ID}`);
});

setInterval(sendTick, INTERVAL_MS);
sendTick();

if (process.argv.includes("--accident")) setTimeout(triggerAccident, 1500);

process.on("SIGINT", () => {
  controlServer.close();
  process.exit(0);
});
