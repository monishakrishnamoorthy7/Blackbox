import { useDashboard } from "../context/DashboardContext.jsx";

export function useAccident() {
  const {
    accidents,
    activeAlert,
    countdown,
    alertOutcome,
    cancelAlert,
    simulateAccident,
    simulateBusy,
    simulateError,
  } = useDashboard();

  return {
    accidents,
    activeAlert,
    countdown,
    alertOutcome,
    cancelAlert,
    simulateAccident,
    simulateBusy,
    simulateError,
  };
}
