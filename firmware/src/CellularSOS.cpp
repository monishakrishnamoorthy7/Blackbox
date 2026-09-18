#include "CellularSOS.h"
#include "config.h"

bool CellularSOS::begin() {
  modemSerial.begin(MODEM_BAUD, SERIAL_8N1, PIN_MODEM_RX, PIN_MODEM_TX);

#if PIN_MODEM_POWER >= 0
  pinMode(PIN_MODEM_POWER, OUTPUT);
  digitalWrite(PIN_MODEM_POWER, HIGH);
  delay(1500);
  digitalWrite(PIN_MODEM_POWER, LOW);
  delay(3000); // A7670C boot time
#endif

  return sendCommand("AT", "OK", 2000);
}

String CellularSOS::readResponse(unsigned long timeoutMs) {
  String response;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (modemSerial.available()) {
      response += (char)modemSerial.read();
    }
    if (response.indexOf("OK") >= 0 || response.indexOf("ERROR") >= 0) break;
  }
  return response;
}

bool CellularSOS::sendCommand(const String &command, const String &expect, unsigned long timeoutMs) {
  while (modemSerial.available()) modemSerial.read(); // flush
  modemSerial.print(command);
  modemSerial.print("\r\n");
  String response = readResponse(timeoutMs);
  return response.indexOf(expect) >= 0;
}

bool CellularSOS::isReady() {
  if (!sendCommand("AT", "OK", 2000)) return false;
  return sendCommand("AT+CREG?", "OK", 2000); // network registration check
}

bool CellularSOS::sendSOS(const Telemetry &sample) {
  if (strlen(EMERGENCY_PHONE_NUMBER) == 0) {
    Serial.println("[CellularSOS] EMERGENCY_PHONE_NUMBER not configured — skipping modem dispatch");
    return false;
  }

  if (!sendCommand("AT+CMGF=1", "OK", 2000)) return false; // text mode SMS

  String mapsLink = "https://maps.google.com/?q=" + String(sample.gps.latitude, 6) + "," + String(sample.gps.longitude, 6);
  String message = "BIKE BLACK BOX: accident detected. Speed " + String(sample.speedKmh, 1) +
                    " km/h. Location: " + (sample.gps.valid ? mapsLink : String("GPS unavailable")) +
                    " Device " DEVICE_ID;

  while (modemSerial.available()) modemSerial.read();
  modemSerial.print("AT+CMGS=\"");
  modemSerial.print(EMERGENCY_PHONE_NUMBER);
  modemSerial.print("\"\r\n");
  delay(200);
  modemSerial.print(message);
  modemSerial.write(0x1A); // Ctrl+Z submits the SMS
  bool smsOk = readResponse(10000).indexOf("OK") >= 0;

  Serial.printf("[CellularSOS] SMS %s\n", smsOk ? "sent" : "failed");

  String dialCommand = "ATD" + String(EMERGENCY_PHONE_NUMBER) + ";";
  bool callOk = sendCommand(dialCommand, "OK", 5000);
  Serial.printf("[CellularSOS] Voice call %s\n", callOk ? "placed" : "failed");

  return smsOk;
}
