import { Menu, Radio, ShieldAlert } from "lucide-react";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { formatClock } from "../../utils/format.js";

export default function Header({ onMenu }) {
  const {
    deviceId,
    now,
    backendOnline,
    socketConnected,
    telemetryFresh,
    activeAlert,
    alertOutcome,
  } = useDashboard();

  const systemOnline = backendOnline && socketConnected;
  const emergency =
    activeAlert ? "ACCIDENT" : alertOutcome === "sos" ? "SOS ACTIVE" : "STANDBY";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0b1220]/90 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg border border-slate-800 p-2 text-slate-300 lg:hidden"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold tracking-wide text-white md:text-lg">Bike Black Box</h1>
          <p className="font-mono text-xs text-slate-400">Device ID: {deviceId}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <StatusChip
          ok={systemOnline}
          label={systemOnline ? "System Online" : "System Degraded"}
          icon={<Radio className="h-3.5 w-3.5" />}
        />
        <StatusChip
          ok={telemetryFresh}
          label={telemetryFresh ? "Telemetry Live" : "No Live Telemetry"}
          warn={!telemetryFresh}
        />
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            emergency === "STANDBY"
              ? "bg-slate-800 text-slate-300"
              : emergency === "SOS ACTIVE"
                ? "bg-red-600 text-white"
                : "animate-pulse bg-red-500 text-white"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {emergency}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 font-mono text-xs text-slate-300">
          {formatClock(now)}
        </div>
      </div>
    </header>
  );
}

function StatusChip({ ok, label, icon, warn }) {
  const color = ok ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : warn ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : "text-red-300 bg-red-500/10 border-red-500/20";
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${color}`}>
      {icon}
      {label}
    </div>
  );
}
