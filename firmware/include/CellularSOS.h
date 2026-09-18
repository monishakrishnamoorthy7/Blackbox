// Minimal AT-command driver for the A7670C LTE/GSM modem: enough to send an
// SOS SMS with a Google Maps link and place a follow-up voice call. This is
// the real hardware counterpart to sendEmergencySOS() in
// backend/src/services/emergencyService.js, which only simulates the send.
#pragma once
#include <Arduino.h>
#include "Telemetry.h"

class CellularSOS {
 public:
  bool begin();
  // Blocks for a few seconds while the modem is confirmed to be responsive
  // and registered on the network. Safe to call again later to re-check.
  bool isReady();
  // Sends "BLACK BOX ALERT" SMS with GPS + telemetry summary, then dials the
  // emergency contact. Returns false if the modem never returned an OK.
  bool sendSOS(const Telemetry &sample);

 private:
  HardwareSerial modemSerial{2};
  bool sendCommand(const String &command, const String &expect, unsigned long timeoutMs);
  String readResponse(unsigned long timeoutMs);
};
