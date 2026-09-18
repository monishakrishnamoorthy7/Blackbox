#include "TelemetryClient.h"
#include "config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

void TelemetryClient::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void TelemetryClient::ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    online_ = true;
    return;
  }
  online_ = false;
  unsigned long now = millis();
  if (now - lastWifiAttemptMs_ < 5000) return; // don't hammer reconnects
  lastWifiAttemptMs_ = now;
  Serial.println("[TelemetryClient] WiFi not connected, retrying...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

String TelemetryClient::buildTelemetryJson(const Telemetry &sample) {
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;

  JsonObject accel = doc["acceleration"].to<JsonObject>();
  accel["x"] = sample.acceleration.x;
  accel["y"] = sample.acceleration.y;
  accel["z"] = sample.acceleration.z;

  JsonObject gyro = doc["gyroscope"].to<JsonObject>();
  gyro["x"] = sample.gyroscope.x;
  gyro["y"] = sample.gyroscope.y;
  gyro["z"] = sample.gyroscope.z;

  doc["speed"] = sample.speedKmh;
  doc["leanAngle"] = sample.leanAngleDeg;
  doc["temperature"] = sample.temperatureC;
  doc["current"] = sample.currentAmps;
  doc["vibration"] = sample.vibration;

  JsonObject gps = doc["gps"].to<JsonObject>();
  if (sample.gps.valid) {
    gps["latitude"] = sample.gps.latitude;
    gps["longitude"] = sample.gps.longitude;
  } else {
    gps["latitude"] = nullptr;
    gps["longitude"] = nullptr;
  }
  gps["speed"] = sample.gps.speedKmh;
  gps["course"] = sample.gps.courseDeg;
  gps["status"] = sample.gps.valid ? "fix" : "nofix";

  doc["networkStatus"] = sample.networkOnline ? "online" : "offline";
  doc["accidentStatus"] = "normal"; // backend runs the authoritative detector itself

  String json;
  serializeJson(doc, json);
  return json;
}

bool TelemetryClient::postJson(const String &path, const String &json) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(String(API_BASE_URL) + path);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(4000);
  int status = http.POST(json);
  http.end();

  if (status < 200 || status >= 300) {
    Serial.printf("[TelemetryClient] POST %s failed (%d)\n", path.c_str(), status);
    return false;
  }
  return true;
}

bool TelemetryClient::postTelemetry(const Telemetry &sample) {
  String json = buildTelemetryJson(sample);

  // Drain anything queued from a previous outage first, so order is preserved.
  sd_.drain([this](const String &line) { return postJson("/api/telemetry", line); });

  bool sent = postJson("/api/telemetry", json);
  if (!sent) {
    sd_.appendLine(json);
  }
  return sent;
}

bool TelemetryClient::postAccident(const Telemetry &sample, const char *severity) {
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["speed"] = sample.speedKmh;
  doc["leanAngle"] = sample.leanAngleDeg;
  doc["severity"] = severity;
  doc["source"] = "device";
  doc["message"] = "Local on-device accident detection (mirrors backend thresholds)";

  JsonObject accel = doc["acceleration"].to<JsonObject>();
  accel["x"] = sample.acceleration.x;
  accel["y"] = sample.acceleration.y;
  accel["z"] = sample.acceleration.z;

  JsonObject gyro = doc["gyroscope"].to<JsonObject>();
  gyro["x"] = sample.gyroscope.x;
  gyro["y"] = sample.gyroscope.y;
  gyro["z"] = sample.gyroscope.z;

  JsonObject gps = doc["gps"].to<JsonObject>();
  if (sample.gps.valid) {
    gps["latitude"] = sample.gps.latitude;
    gps["longitude"] = sample.gps.longitude;
  } else {
    gps["latitude"] = nullptr;
    gps["longitude"] = nullptr;
  }
  gps["status"] = sample.gps.valid ? "fix" : "nofix";

  String json;
  serializeJson(doc, json);
  return postJson("/api/accidents", json);
}
