import { useDashboard } from "../context/DashboardContext.jsx";

export function useTelemetry() {
  const { telemetry, chartPoints, telemetryFresh, gpsOk, lastSeenAt } = useDashboard();
  return { telemetry, chartPoints, telemetryFresh, gpsOk, lastSeenAt };
}
