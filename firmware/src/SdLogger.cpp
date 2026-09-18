#include "SdLogger.h"
#include "config.h"
#include <SPI.h>
#include <SD.h>

bool SdLogger::begin() {
  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  ready_ = SD.begin(PIN_SD_CS, SPI);
  if (!ready_) {
    Serial.println("[SdLogger] MicroSD not found — offline buffering disabled");
  }
  return ready_;
}

bool SdLogger::appendLine(const String &jsonLine) {
  if (!ready_) return false;
  File file = SD.open(kQueuePath, FILE_APPEND);
  if (!file) return false;
  file.println(jsonLine);
  file.close();
  return true;
}

void SdLogger::drain(const std::function<bool(const String &line)> &onLine) {
  if (!ready_ || !SD.exists(kQueuePath)) return;

  File source = SD.open(kQueuePath, FILE_READ);
  if (!source) return;

  SD.remove(kTempPath);
  File remaining = SD.open(kTempPath, FILE_WRITE);
  bool stillFailing = false;

  while (source.available()) {
    String line = source.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    if (!stillFailing && onLine(line)) {
      continue; // sent successfully, drop it
    }
    stillFailing = true; // once one POST fails, keep the rest in order
    if (remaining) remaining.println(line);
  }

  source.close();
  if (remaining) remaining.close();

  SD.remove(kQueuePath);
  if (stillFailing) SD.rename(kTempPath, kQueuePath);
  else SD.remove(kTempPath);
}
