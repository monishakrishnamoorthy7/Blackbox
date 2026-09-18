import { useDashboard } from "../../context/DashboardContext.jsx";
import { TELEMETRY_STALE_MS } from "../../config.js";
import { hasGpsFix } from "../../utils/format.js";

export default function SensorStatus() {
  const { telemetry, lastSeenAt, socketConnected, backendOnline } = useDashboard();
  const age = lastSeenAt ? Date.now() - lastSeenAt : Infinity;
  const live = age < TELEMETRY_STALE_MS;
  const warning = age < TELEMETRY_STALE_MS * 3;

  const sensors = [
    { name: "MPU6050", detail: "IMU / lean / impact", state: live ? "Online" : warning ? "Warning" : "Offline" },
    { name: "NEO-6M GPS", detail: "Position lock", state: hasGpsFix(telemetry) && live ? "Online" : telemetry?.gps ? "Warning" : "Offline" },
    { name: "MAX6675", detail: "Temperature", state: live && telemetry?.temperature != null ? "Online" : warning ? "Warning" : "Offline" },
    { name: "ACS712", detail: "Current sense", state: live && telemetry?.current != null ? "Online" : warning ? "Warning" : "Offline" },
    { name: "SW-420", detail: telemetry?.vibration === true ? "VIBRATION DETECTED" : "NORMAL / NO VIBRATION", state: live ? (telemetry?.vibration === true ? "Warning" : "Online") : warning ? "Warning" : "Offline" },
    { name: "A7670C", detail: "Cellular / network", state: live && telemetry?.networkStatus === "online" ? "Online" : backendOnline ? "Warning" : "Offline" },
    { name: "MicroSD", detail: "Local black-box store", state: live ? "Online" : warning ? "Warning" : "Offline" },
    { name: "ESP32-S3", detail: "Edge controller", state: live ? "Online" : socketConnected ? "Warning" : "Offline" },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="mb-4 text-sm font-semibold text-white">Sensor Status</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {sensors.map((sensor) => (
          <div key={sensor.name} className="rounded-xl border border-slate-800 bg-[#0b1220] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">{sensor.name}</p>
              <span className={`h-2.5 w-2.5 rounded-full ${dot(sensor.state)}`} />
            </div>
            <p className="text-[11px] text-slate-500">{sensor.detail}</p>
            <p className={`mt-2 text-xs font-semibold ${text(sensor.state)}`}>{sensor.state}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function dot(state) {
  if (state === "Online") return "bg-emerald-400";
  if (state === "Warning") return "bg-amber-400";
  return "bg-red-500";
}

function text(state) {
  if (state === "Online") return "text-emerald-300";
  if (state === "Warning") return "text-amber-300";
  return "text-red-300";
}
