const API_BASE = import.meta.env.VITE_API_URL || "";
const SIMULATOR_BASE = import.meta.env.VITE_SIMULATOR_URL || "/simulator";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function simulatorRequest(path, options = {}) {
  const response = await fetch(`${SIMULATOR_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Simulator request failed (${response.status})`);
  return body;
}

export const api = {
  getHealth: () => request("/api/health"),
  getStatus: () => request("/api/status"),
  getSettings: () => request("/api/settings"),
  getTelemetry: (deviceId, limit = 50) => {
    const params = new URLSearchParams();
    if (deviceId) params.set("deviceId", deviceId);
    if (limit) params.set("limit", String(limit));
    return request(`/api/telemetry?${params.toString()}`);
  },
  getLatestTelemetry: (deviceId) => {
    const params = new URLSearchParams();
    if (deviceId) params.set("deviceId", deviceId);
    return request(`/api/telemetry/latest?${params.toString()}`);
  },
  getAccidents: (deviceId, limit = 50) => {
    const params = new URLSearchParams();
    if (deviceId) params.set("deviceId", deviceId);
    if (limit) params.set("limit", String(limit));
    return request(`/api/accidents?${params.toString()}`);
  },
  postAccident: (payload) =>
    request("/api/accidents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSimulatorStatus: () => simulatorRequest("/control/status"),
  controlSimulator: (command) => simulatorRequest(`/control/${command}`, { method: "POST" }),
  getEmergencyEvents: (deviceId, limit = 50) => {
    const params = new URLSearchParams();
    if (deviceId) params.set("deviceId", deviceId);
    params.set("limit", String(limit));
    return request(`/api/emergency?${params.toString()}`);
  },
  postEmergencySOS: (payload) => request("/api/emergency/sos", { method: "POST", body: JSON.stringify(payload) }),
  cancelEmergency: (payload) => request("/api/emergency/cancel", { method: "POST", body: JSON.stringify(payload) }),
  postManualSOS: (payload) => request("/api/emergency/manual-sos", { method: "POST", body: JSON.stringify(payload) }),
  getAccidentBlockchain: (accidentId) => request(`/api/accidents/${encodeURIComponent(accidentId)}/blockchain`),
  verifyAccidentBlockchain: (accidentId) => request(`/api/accidents/${encodeURIComponent(accidentId)}/blockchain/verify`, { method: "POST" }),
  getReportAccidents: (filters = {}) => request(`/api/reports/accidents?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value != null))}`),
  getReportSummary: (filters = {}) => request(`/api/reports/summary?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value != null))}`),
};
