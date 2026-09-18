# Bike Black Box System

Real-Time Accident Detection & Emergency Response for Motorcycles.

This is the **software foundation**. Hardware is not required. A Node simulator posts telemetry to the backend using the same HTTP contract an ESP32 will use later.

The frontend provides a live operations dashboard for telemetry, tracking, sensor health, and accident response.

## Stack

- Frontend: React + Vite, Tailwind CSS, Lucide React, Recharts, React Leaflet + Leaflet
- Backend: Node.js, Express, Socket.IO, MongoDB + Mongoose, dotenv, CORS
- Simulator: Node.js `fetch` client

## Prerequisites

- Node.js 18+
- MongoDB running locally (default `mongodb://127.0.0.1:27017`)

## Install

From the project root:

```bash
cd backend
copy .env.example .env
npm install

cd ../frontend
copy .env.example .env
npm install

cd ../simulator
copy .env.example .env
npm install

cd ..
npm install
```

On macOS/Linux use `cp .env.example .env` instead of `copy`.

## Run complete system

From the project root, start the backend, frontend, and simulator together:

```bash
npm start
```

The backend listens on `http://localhost:4000`, the dashboard on `http://localhost:5173`, and the simulator control API on `http://localhost:4100`.

## Run backend

```bash
cd backend
npm run dev
```

Server: `http://localhost:4000`

## Run frontend

```bash
cd frontend
npm run dev
```

App: `http://localhost:5173`

## Run simulator (sends live data to the API)

Keep the backend running, then:

```bash
cd simulator
npm start
```

The simulator sends telemetry every second from Chennai coordinates and exposes a control API on `http://localhost:4100`:

```powershell
Invoke-RestMethod -Method POST http://localhost:4100/control/start
Invoke-RestMethod -Method POST http://localhost:4100/control/stop
Invoke-RestMethod -Method POST http://localhost:4100/control/accident
Invoke-RestMethod -Method POST http://localhost:4100/control/gps-lost
Invoke-RestMethod -Method POST http://localhost:4100/control/gps-restore
Invoke-RestMethod http://localhost:4100/control/status
```

The dashboard exposes the same controls in its Demo Control panel. When MongoDB is unavailable, the backend keeps a bounded in-memory telemetry and accident buffer so the simulator and realtime dashboard remain usable; MongoDB is used automatically when it becomes available.

## Accident and emergency workflow

Telemetry is evaluated by the backend detector using configurable impact, rotation, speed-drop, lean, and stationary thresholds in `backend/src/config/accidentDetection.js`. One signal produces `SUSPECTED`; at least three corroborating signals inside the confirmation window produce `CONFIRMED` and a 10-second rider countdown in the dashboard.

Emergency APIs:

- `POST /api/emergency/manual-sos` with `{ "deviceId": "BBX-SIM-001" }`
- `POST /api/emergency/sos` to persist an automatic SOS
- `POST /api/emergency/cancel` to persist a cancelled alert
- `GET /api/emergency?deviceId=BBX-SIM-001`

Socket.IO lifecycle events:

- `telemetry:update`
- `accident:suspected`
- `accident:confirmed`
- `accident:countdown`
- `accident:cancelled`
- `emergency:sos`
- `emergency:manual`

The A7670C integration is represented by `sendEmergencySOS()`. Simulator mode logs `[A7670C SIMULATION] SOS would be sent`; it does not send SMS or place calls.

## Tamper-Evident Accident Evidence

When an accident is confirmed and persisted, the backend creates an allowlisted evidence snapshot, generates a deterministic SHA-256 hash, and records only that hash plus minimal metadata in a local append-only JSONL hash chain at `backend/data/evidence-ledger.jsonl`.

```text
Accident -> Evidence Snapshot -> SHA-256 -> Append-only Hash Chain -> Verification
```

Raw GPS coordinates, raw telemetry, personal information, and emergency contact information never enter the ledger. Detailed accident evidence remains in the existing application storage and memory fallback. Evidence recording and verification are isolated from accident detection, the rider countdown, cancellation, and SOS dispatch; those workflows continue if the ledger is unavailable. Failed recordings are marked unavailable and retried asynchronously without blocking the accident API.

Accident History exposes verification metadata and a `Verify Evidence` action through:

- `GET /api/accidents/:id/blockchain`
- `POST /api/accidents/:id/blockchain/verify`
- `GET /api/blockchain/status`

For the hackathon prototype, the system uses a local append-only hash-chain ledger. The architecture is designed so that a future Polygon/EVM blockchain adapter can replace the local ledger.

Test the complete flow:

1. Start backend, frontend, and simulator.
2. Click **Accident** in the dashboard Demo Control panel.
3. Cancel the countdown to create `CANCELLED`, or wait ten seconds to create `SOS_TRIGGERED`.
4. Use **Manual SOS**, then click it again to confirm.

Send a one-shot accident alert:

```bash
cd simulator
npm run accident
```

## Test backend

Health (503 is expected if MongoDB is down):

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/status
```

Post telemetry:

```bash
curl -X POST http://localhost:4000/api/telemetry -H "Content-Type: application/json" -d "{\"deviceId\":\"BBX-SIM-001\",\"speed\":32.4,\"acceleration\":{\"x\":0.2,\"y\":0.1,\"z\":9.8},\"gyroscope\":{\"x\":0.4,\"y\":-0.2,\"z\":0.1},\"leanAngle\":7.5,\"temperature\":36.2,\"current\":1.8,\"gps\":{\"latitude\":12.9716,\"longitude\":77.5946,\"speed\":32.1,\"course\":90,\"status\":\"fix\"},\"networkStatus\":\"online\",\"accidentStatus\":\"normal\"}"
```

Read telemetry:

```bash
curl "http://localhost:4000/api/telemetry?deviceId=BBX-SIM-001&limit=5"
curl "http://localhost:4000/api/telemetry/latest?deviceId=BBX-SIM-001"
```

Accident alert:

```bash
curl -X POST http://localhost:4000/api/accidents -H "Content-Type: application/json" -d "{\"deviceId\":\"BBX-SIM-001\",\"speed\":11,\"leanAngle\":54,\"severity\":\"high\",\"gps\":{\"latitude\":12.9716,\"longitude\":77.5946,\"status\":\"fix\"},\"source\":\"simulator\"}"
```

```bash
curl "http://localhost:4000/api/accidents?deviceId=BBX-SIM-001"
```

PowerShell equivalents:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/status
Invoke-RestMethod -Method POST http://localhost:4000/api/telemetry -ContentType "application/json" -Body '{"deviceId":"BBX-SIM-001","speed":32.4,"acceleration":{"x":0.2,"y":0.1,"z":9.8},"gyroscope":{"x":0.4,"y":-0.2,"z":0.1},"leanAngle":7.5,"temperature":36.2,"current":1.8,"gps":{"latitude":12.9716,"longitude":77.5946,"speed":32.1,"course":90,"status":"fix"},"networkStatus":"online","accidentStatus":"normal"}'
Invoke-RestMethod "http://localhost:4000/api/telemetry?deviceId=BBX-SIM-001&limit=5"
```

## API contract (ESP32 later)

Replace the simulator with ESP32 firmware that POSTs JSON to:

- `POST /api/telemetry`
- `POST /api/accidents`

Realtime events (Socket.IO):

- `telemetry:update`
- `accident:suspected`
- `accident:confirmed`
- `accident:countdown`
- `accident:cancelled`
- `emergency:sos`
- `emergency:manual`

## Layout

```
bike-black-box/
├── frontend/
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── sockets/
│       └── utils/
├── simulator/
└── README.md
```
