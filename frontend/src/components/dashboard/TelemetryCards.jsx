import { useDashboard } from "../../context/DashboardContext.jsx";
import { formatCoord, impactMagnitude } from "../../utils/format.js";
import { BatteryCharging, Gauge, Navigation, Radio, Thermometer, Vibrate, Waves, Zap } from "lucide-react";

export default function TelemetryCards() {
  const { telemetry, telemetryFresh, gpsOk } = useDashboard();
  const impact = impactMagnitude(telemetry?.acceleration);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <Card icon={Gauge} label="Speed" value={num(telemetry?.speed, 1)} unit="km/h" />
      <Card icon={Zap} label="Acceleration / Impact" value={num(impact, 2)} unit="m/s²" accent={impact > 15} />
      <Card icon={Waves} label="Lean Angle" value={num(telemetry?.leanAngle, 1)} unit="deg" accent={Math.abs(telemetry?.leanAngle || 0) > 40} />
      <Card icon={Thermometer} label="Temperature" value={num(telemetry?.temperature, 1)} unit="°C" />
      <Card icon={BatteryCharging} label="Current" value={num(telemetry?.current, 2)} unit="A" />
      <Card icon={Navigation} label="GPS Status" value={gpsOk ? "FIX" : telemetry?.gps ? String(telemetry.gps.status || "NO FIX").toUpperCase() : "NO DATA"} detail={gpsOk ? `${formatCoord(telemetry.gps.latitude)}, ${formatCoord(telemetry.gps.longitude)}` : "Waiting for valid coordinates"} warn={!gpsOk} />
      <Card icon={Radio} label="Network Status" value={(telemetry?.networkStatus || "unknown").toUpperCase()} warn={!telemetryFresh} />
      <Card icon={Vibrate} label="SW-420 Vibration" value={telemetry?.vibration === undefined ? "N/A" : telemetry.vibration ? "DETECTED" : "NORMAL"} warn={telemetry?.vibration === true} />
    </section>
  );
}

function num(value, digits) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function Card({ icon: Icon, label, value, unit, detail, accent, warn }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between text-slate-400">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-red-400" : warn ? "text-amber-400" : "text-cyan-400"}`} />
      </div>
      <p className={`text-2xl font-semibold ${accent ? "text-red-300" : "text-white"}`}>
        {value}
        {unit && value !== "—" ? <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-2 truncate text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}
