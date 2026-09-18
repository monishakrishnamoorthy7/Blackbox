import { isDatabaseReady } from "../config/db.js";
import { env } from "../config/env.js";

export function getHealth(_req, res) {
  const dbReady = isDatabaseReady();
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    service: "bike-black-box-backend",
    timestamp: new Date().toISOString(),
    database: dbReady ? "connected" : "disconnected",
    env: env.nodeEnv,
  });
}

export function getStatus(_req, res) {
  res.json({
    service: "bike-black-box-backend",
    ready: isDatabaseReady(),
    realtime: "socket.io",
    ingest: {
      telemetry: "POST /api/telemetry",
      accident: "POST /api/accidents",
    },
    note: "Replace the Node simulator with ESP32 later; the HTTP contract stays the same.",
  });
}
