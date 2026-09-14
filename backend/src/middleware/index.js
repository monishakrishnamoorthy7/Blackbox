export function requireDeviceId(req, res, next) {
  const deviceId = req.body?.deviceId || req.query?.deviceId;
  if (!deviceId || String(deviceId).trim() === "") {
    return res.status(400).json({
      ok: false,
      error: "deviceId is required",
    });
  }
  next();
}

export function validateTelemetry(req, res, next) {
  const body = req.body || {};
  const numericFields = ["speed", "leanAngle", "temperature", "current"];
  const invalid = numericFields.find((field) => body[field] !== undefined && !Number.isFinite(Number(body[field])));
  if (invalid) {
    return res.status(400).json({ ok: false, error: `${invalid} must be a finite number` });
  }
  if (body.vibration !== undefined && typeof body.vibration !== "boolean") {
    return res.status(400).json({ ok: false, error: "vibration must be a boolean" });
  }
  next();
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: err.message || "Internal server error",
  });
}

export function notFound(_req, res) {
  res.status(404).json({ ok: false, error: "Not found" });
}
