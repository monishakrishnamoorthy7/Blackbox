#include "AccidentDetector.h"
#include <Arduino.h>
#include <math.h>

AccidentDetector::AccidentDetector(const AccidentThresholds &thresholds) : thresholds_(thresholds) {}

static float magnitude(const Vector3 &v) {
  return sqrtf(v.x * v.x + v.y * v.y + v.z * v.z);
}

bool AccidentDetector::update(const Telemetry &sample) {
  float impact = magnitude(sample.acceleration);
  float rotation = magnitude(sample.gyroscope);
  float speedDrop = max(0.0f, previousSpeedKmh_ - sample.speedKmh);
  float speedDropRatio = previousSpeedKmh_ > 1 ? speedDrop / previousSpeedKmh_ : 0;
  float leanAngle = fabsf(sample.leanAngleDeg);
  previousSpeedKmh_ = sample.speedKmh;

  int signals = 0;
  if (impact >= thresholds_.impact) signals++;
  if (rotation >= thresholds_.rotation) signals++;
  if (speedDrop >= thresholds_.speedDropKmh || speedDropRatio >= thresholds_.speedDropRatio) signals++;
  if (leanAngle >= thresholds_.leanAngleDeg) signals++;
  if (sample.vibration) signals++;

  unsigned long now = millis();
  bool justConfirmed = false;

  switch (state_) {
    case AccidentState::NORMAL:
      if (signals > 0) {
        state_ = AccidentState::SUSPECTED;
        suspectedAtMs_ = now;
      }
      break;

    case AccidentState::SUSPECTED:
      if (signals >= thresholds_.requiredSignals) {
        state_ = AccidentState::CONFIRMED;
        justConfirmed = true;
      } else if (now - suspectedAtMs_ > thresholds_.confirmationWindowMs) {
        state_ = AccidentState::NORMAL;
      }
      break;

    case AccidentState::CONFIRMED:
      if (signals == 0) state_ = AccidentState::NORMAL;
      break;
  }

  return justConfirmed;
}
