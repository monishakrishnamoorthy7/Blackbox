// Bike Black Box — ESP32-S3 firmware
//
// Reads MPU6050 (accel/gyro), NEO-6M GPS, MAX6675 (temperature), ACS712
// (current), SW-420 (vibration), buffers to MicroSD when offline, and POSTs
// telemetry to the backend on the exact HTTP contract the Node simulator
// uses (see README.md at the repo root: "API contract (ESP32 later)").
//
// On top of that, it runs a local copy of the backend's accident-detection
// thresholds so the onboard A7670C modem can fire a real SMS/voice SOS even
// if WiFi/the backend is down — something the backend itself cannot do.
//
// Setup: copy include/config.example.h to include/config.h and fill in your
// WiFi, backend URL, device ID, and emergency contact number first.

#include <Arduino.h>
#include "config.h"
#include "Telemetry.h"
#include "SensorHub.h"
#include "AccidentDetector.h"
#include "TelemetryClient.h"
#include "CellularSOS.h"
#include "SdLogger.h"

static SensorHub sensors;
static SdLogger sdLogger;
static TelemetryClient telemetryClient(sdLogger);
static CellularSOS cellular;
static AccidentDetector accidentDetector;

static unsigned long lastSampleMs = 0;
static bool modemReady = false;

static void blinkStatus(int times, int onMs = 80, int offMs = 80) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(onMs);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(offMs);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[BlackBox] Booting...");

  pinMode(PIN_STATUS_LED, OUTPUT);

  bool imuOk = sensors.begin();
  bool sdOk = sdLogger.begin();
  modemReady = cellular.begin();

  telemetryClient.begin();

  Serial.printf("[BlackBox] MPU6050: %s | MicroSD: %s | A7670C: %s\n",
                imuOk ? "OK" : "MISSING",
                sdOk ? "OK" : "MISSING",
                modemReady ? "OK" : "MISSING");

  blinkStatus(3);
}

void loop() {
  // Keep GPS parsing continuous, not just once per telemetry tick.
  sensors.pumpGps();
  telemetryClient.ensureWifi();

  unsigned long now = millis();
  if (now - lastSampleMs < TELEMETRY_INTERVAL_MS) return;
  lastSampleMs = now;

  Telemetry sample;
  sample.networkOnline = telemetryClient.isOnline();
  sensors.sample(sample);

  bool sent = telemetryClient.postTelemetry(sample);
  digitalWrite(PIN_STATUS_LED, sent ? HIGH : LOW);

  Serial.printf(
      "[BlackBox] speed=%.1fkm/h accel=(%.2f,%.2f,%.2f) lean=%.1f temp=%.1fC current=%.2fA "
      "gps=%s vib=%d net=%s\n",
      sample.speedKmh, sample.acceleration.x, sample.acceleration.y, sample.acceleration.z,
      sample.leanAngleDeg, sample.temperatureC, sample.currentAmps,
      sample.gps.valid ? "fix" : "nofix", sample.vibration, sent ? "sent" : "queued");

  if (accidentDetector.update(sample)) {
    Serial.println("[BlackBox] *** LOCAL ACCIDENT CONFIRMATION — dispatching SOS ***");
    telemetryClient.postAccident(sample, "critical");
    if (modemReady) {
      cellular.sendSOS(sample);
    } else {
      Serial.println("[BlackBox] Modem not ready — SOS SMS/call skipped, relying on backend/dashboard flow");
    }
  }
}
