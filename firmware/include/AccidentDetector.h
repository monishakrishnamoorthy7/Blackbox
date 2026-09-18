// Local mirror of backend/src/config/accidentDetection.js and
// backend/src/services/accidentDetectionService.js.
//
// The backend already runs this same logic on every /api/telemetry POST and
// drives the dashboard's SUSPECTED -> CONFIRMED -> countdown -> SOS flow, so
// this device-side copy is NOT required for the dashboard to work.
//
// It exists for one reason: the backend has no cellular modem. Only this
// firmware can place a real SMS/voice SOS through the A7670C, and it must be
// able to do that even if WiFi/the backend is unreachable. So the ESP32 runs
// its own copy of the thresholds purely to decide when to fire the modem.
#pragma once
#include "Telemetry.h"

struct AccidentThresholds {
  float impact = 15.0f;         // m/s^2
  float rotation = 35.0f;       // deg/s
  float speedDropKmh = 10.0f;   // km/h
  float speedDropRatio = 0.35f;
  float leanAngleDeg = 35.0f;
  unsigned long confirmationWindowMs = 2500;
  int requiredSignals = 3;
};

enum class AccidentState { NORMAL, SUSPECTED, CONFIRMED };

class AccidentDetector {
 public:
  explicit AccidentDetector(const AccidentThresholds &thresholds = AccidentThresholds());
  // Feed each new sample in; returns true exactly once, the moment a crash
  // is confirmed (edge-triggered, so callers don't fire the modem twice).
  bool update(const Telemetry &sample);
  AccidentState state() const { return state_; }

 private:
  AccidentThresholds thresholds_;
  AccidentState state_ = AccidentState::NORMAL;
  float previousSpeedKmh_ = 0;
  unsigned long suspectedAtMs_ = 0;
};
