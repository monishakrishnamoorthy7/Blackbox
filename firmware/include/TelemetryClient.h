// WiFi connection management + HTTP POST to the same endpoints the Node
// simulator uses (backend/src/routes/telemetry.js, accident.js). Falls back
// to SdLogger when the backend is unreachable and drains the queue once
// connectivity returns.
#pragma once
#include <Arduino.h>
#include "Telemetry.h"
#include "SdLogger.h"

class TelemetryClient {
 public:
  explicit TelemetryClient(SdLogger &sdLogger) : sd_(sdLogger) {}

  void begin();
  // Non-blocking-ish: reconnects if the link dropped, safe to call every loop().
  void ensureWifi();
  bool isOnline() const { return online_; }

  // Serializes `sample` to the /api/telemetry JSON contract and POSTs it.
  // Buffers to SD and returns false if the backend can't be reached.
  bool postTelemetry(const Telemetry &sample);

  // POSTs a confirmed-accident record to /api/accidents (source: "device"),
  // matching backend/src/controllers/accidentController.js.
  bool postAccident(const Telemetry &sample, const char *severity);

  String buildTelemetryJson(const Telemetry &sample);

 private:
  SdLogger &sd_;
  bool online_ = false;
  unsigned long lastWifiAttemptMs_ = 0;

  bool postJson(const String &path, const String &json);
};
