// Shared telemetry structure. Field names and units mirror the backend's
// normalizeTelemetryPayload() contract exactly (backend/src/services/telemetryService.js):
//   speed            km/h
//   acceleration.xyz m/s^2 (z ~9.81 at rest, gravity included — not offset)
//   gyroscope.xyz    deg/s
//   leanAngle        degrees, signed roll
//   temperature      degrees C
//   current          amps
//   gps.*            latitude/longitude in degrees, speed km/h, course degrees,
//                     status one of "fix" | "nofix" | "estimated"
//   vibration        bool, SW-420 digital read
//   networkStatus    "online" | "offline"
//   accidentStatus   "normal" | "warning" | "accident" (informational only —
//                     the backend runs its own detector on every /api/telemetry post)

#pragma once
#include <Arduino.h>

struct Vector3 {
  float x, y, z;
  Vector3(float x = 0, float y = 0, float z = 0) : x(x), y(y), z(z) {}
};

struct GpsFix {
  bool valid = false;
  double latitude = 0;
  double longitude = 0;
  float speedKmh = 0;
  float courseDeg = 0;
};

struct Telemetry {
  unsigned long millisAtSample = 0;
  float speedKmh = 0;
  Vector3 acceleration;
  Vector3 gyroscope;
  float leanAngleDeg = 0;
  float temperatureC = 0;
  float currentAmps = 0;
  bool vibration = false;
  GpsFix gps;
  bool networkOnline = true;
};
