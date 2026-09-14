import { ShieldAlert, X } from "lucide-react";
import { memo } from "react";
import { useDashboard, useEmergency } from "../../context/DashboardContext.jsx";
import { formatCoord, impactMagnitude } from "../../utils/format.js";

function AccidentAlert() {
  const { activeAlert, countdown, cancelAlert, alertOutcome, accidentState, sosToastVisible, dismissSosToast } = useEmergency();
  const { view } = useDashboard();

  if (view === "alerts") return null;

  if (!activeAlert && !alertOutcome) return null;

  if (!activeAlert && alertOutcome === "cancelled") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-2xl border border-amber-400/40 bg-amber-950/90 p-4 text-amber-100 shadow-2xl">
        <p className="text-sm font-semibold">False Alarm / Alert Cancelled</p>
        <p className="mt-1 text-xs text-amber-200/80">SOS was not dispatched. Event remains in accident history.</p>
      </div>
    );
  }

  if (!activeAlert && alertOutcome === "sos" && sosToastVisible) {
    return (
      <button type="button" onClick={dismissSosToast} aria-label="Dismiss SOS notification" className="fixed bottom-4 right-4 z-50 max-w-md rounded-2xl border border-red-400/50 bg-red-950/95 p-4 text-left text-white shadow-2xl">
        <p className="text-sm font-black tracking-wide">SOS TRIGGERED</p>
        <p className="mt-1 text-xs text-red-100/80">Emergency sequence engaged. Responders would be notified in production.</p>
      </button>
    );
  }

  if (!activeAlert) return null;

  const alert = activeAlert.alert;
  const telem = activeAlert.telemetry;
  const lat = alert.latitude ?? telem?.gps?.latitude;
  const lng = alert.longitude ?? telem?.gps?.longitude;
  const speed = alert.speed ?? telem?.speed;
  const impact = Number(alert.impact ?? impactMagnitude(telem?.acceleration));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/70 p-4 backdrop-blur-sm">
      <div className="emergency-pulse w-full max-w-xl rounded-3xl border border-red-400 bg-[#1a0505] p-6 text-white shadow-[0_0_80px_rgba(220,38,38,0.45)]">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-600 p-3">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300">Emergency alert</p>
              <h2 className="text-2xl font-black">ACCIDENT DETECTED</h2>
            </div>
          </div>
          <button onClick={cancelAlert} className="rounded-lg p-2 text-red-200 hover:bg-red-900" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Severity" value={String(alert.severity || "high").toUpperCase()} />
          <Info label="Device" value={alert.deviceId} />
          <Info label="Location" value={lat != null ? `${formatCoord(lat)}, ${formatCoord(lng)}` : "GPS unavailable"} />
          <Info label="Speed" value={speed != null ? `${Number(speed).toFixed(1)} km/h` : "—"} />
          <Info label="Confidence" value={`${Number(alert.confidence || 0)}%`} />
          <Info label="Impact" value={`${impact.toFixed(2)} m/s²`} />
          <Info label="Lean" value={`${Number(alert.leanAngle ?? telem?.leanAngle ?? 0).toFixed(1)}°`} />
          <Info label="Network" value={alert.networkStatus || telem?.networkStatus || "unknown"} />
          <Info label="Vibration" value={alert.vibration === true || telem?.vibration === true ? "Detected" : alert.vibration === false || telem?.vibration === false ? "Not detected" : "N/A"} />
        </div>
        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="text-sm uppercase tracking-[0.3em] text-red-200">{accidentState} · SOS in</p>
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-400 text-4xl font-black">
            {countdown ?? 0}
          </div>
          <button
            type="button"
            onClick={cancelAlert}
            className="w-full rounded-2xl bg-white py-4 text-lg font-black uppercase tracking-widest text-red-700 hover:bg-red-50"
          >
            Cancel
          </button>
          <p className="text-center text-xs text-red-200/70">Cancel if this is a false alarm. Otherwise SOS triggers automatically.</p>
        </div>
      </div>
    </div>
  );
}

export default memo(AccidentAlert);

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-red-900 bg-red-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-red-300">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
