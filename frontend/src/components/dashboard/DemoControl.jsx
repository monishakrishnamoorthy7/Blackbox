import { LocateFixed, Play, Siren, Square, WifiOff } from "lucide-react";
import { useDashboard } from "../../context/DashboardContext.jsx";

export default function DemoControl() {
  const {
    triggerSimulatorAccident,
    simulateBusy,
    simulateError,
    simulator,
    simulatorError,
    controlSimulator,
    accidentState,
    activeAlert,
    emergencyEvents,
  } = useDashboard();

  async function command(name) {
    try {
      await controlSimulator(name);
    } catch {
      // The error is rendered from context below.
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Simulator controls</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Simulator Emergency Controls</h2>
          <p className="text-sm text-slate-400">
            Drives the real simulator process for BBX-SIM-001. Telemetry continues through the backend socket.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${simulator ? "bg-emerald-400" : "bg-red-400"}`} />{simulator ? "Simulator connected" : "Simulator offline"}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ControlButton icon={Play} label="Start" onClick={() => command("start")} />
        <ControlButton icon={Square} label="Stop" onClick={() => command("stop")} />
        <ControlButton icon={WifiOff} label="GPS Loss" onClick={() => command("gps-lost")} />
        <ControlButton icon={LocateFixed} label="Restore GPS" onClick={() => command("gps-restore")} />
        <ControlButton danger icon={Siren} label={simulateBusy ? "Starting…" : "Simulate Accident"} onClick={triggerSimulatorAccident} disabled={simulateBusy || !simulator} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
        <span>State: <b className="text-slate-300">{simulator?.running ? "running" : "stopped"}</b></span>
        <span>GPS: <b className="text-slate-300">{simulator?.gpsState || "unknown"}</b></span>
        <span>Accident: <b className={accidentState === "NORMAL" ? "text-emerald-300" : "text-red-300"}>{accidentState}</b></span>
        {activeAlert ? <span>Confidence: <b className="text-red-300">{activeAlert.alert.confidence || 0}%</b></span> : null}
        {emergencyEvents[0] ? <span>Latest emergency: <b className="text-slate-300">{emergencyEvents[0].state}</b></span> : null}
        {simulatorError || simulateError ? <span className="text-red-300">{simulatorError || simulateError}</span> : null}
      </div>
    </section>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled, danger }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-center text-xs font-semibold leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "border-red-500/40 bg-red-600 text-white hover:bg-red-500" : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"}`}><Icon className="h-3.5 w-3.5 shrink-0" />{label}</button>;
}
