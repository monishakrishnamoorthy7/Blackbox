// Offline black-box buffer: when the backend can't be reached, telemetry
// lines are appended to a file on the MicroSD card instead of being lost.
// Once connectivity returns, TelemetryClient drains the file line by line.
#pragma once
#include <Arduino.h>
#include <functional>

class SdLogger {
 public:
  bool begin();
  bool appendLine(const String &jsonLine);
  // Calls `onLine` for each buffered line still on disk; stops and keeps the
  // remainder on the first line onLine() returns false for (e.g. POST failed).
  void drain(const std::function<bool(const String &line)> &onLine);
  bool isReady() const { return ready_; }

 private:
  bool ready_ = false;
  static constexpr const char *kQueuePath = "/telemetry_queue.jsonl";
  static constexpr const char *kTempPath = "/telemetry_queue.tmp";
};
