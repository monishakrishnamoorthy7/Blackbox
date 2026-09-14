import { useDashboard } from "../context/DashboardContext.jsx";

export function useSocketConnection() {
  const { socketConnected, backendOnline, backendError } = useDashboard();
  return { socketConnected, backendOnline, backendError };
}
