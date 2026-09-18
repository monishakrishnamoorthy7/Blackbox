export function formatClock(date = new Date()) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCoord(value, digits = 5) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

export function impactMagnitude(acceleration = {}) {
  const x = Number(acceleration.x || 0);
  const y = Number(acceleration.y || 0);
  const z = Number(acceleration.z || 0);
  return Math.sqrt(x * x + y * y + z * z);
}

export function hasGpsFix(telemetry) {
  const lat = telemetry?.gps?.latitude;
  const lng = telemetry?.gps?.longitude;
  const status = telemetry?.gps?.status;
  return (
    status === "fix" &&
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng))
  );
}

export function mapPosition(telemetry, fallback = { latitude: 13.0827, longitude: 80.2707 }) {
  if (hasGpsFix(telemetry)) {
    return {
      latitude: Number(telemetry.gps.latitude),
      longitude: Number(telemetry.gps.longitude),
      fromDevice: true,
    };
  }
  return { ...fallback, fromDevice: false };
}
