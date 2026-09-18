// Bike Black Box — device configuration
//
// Copy this file to `config.h` (same folder) and fill in your real values.
// `config.h` is gitignored so credentials never get committed.
//
//   cp include/config.example.h include/config.h

#pragma once

// ---- WiFi ----------------------------------------------------------------
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// ---- Backend -----------------------------------------------------------
// Same HTTP contract the Node simulator uses. Point this at your backend's
// LAN IP (not "localhost" — that would mean the ESP32 itself).
// Example: "http://192.168.1.50:4000"
#define API_BASE_URL "http://192.168.1.50:4000"
#define DEVICE_ID "BBX-SIM-001"
#define VEHICLE_ID "BIKE-001"

// ---- Emergency contact (for direct A7670C SMS/voice dispatch) ----------
// International format, e.g. "+919876543210". Leave blank to disable the
// modem's own SOS dispatch and rely on the backend/dashboard flow only.
#define EMERGENCY_PHONE_NUMBER ""

// ---- Timing --------------------------------------------------------------
#define TELEMETRY_INTERVAL_MS 1000
#define GPS_BAUD 9600
#define MODEM_BAUD 115200

// ---- Pin map (ESP32-S3-DevKitC-1) ----------------------------------------
// Adjust to match your actual wiring. See firmware/README.md for the wiring
// table this project was written against.

// MPU6050 (I2C)
#define PIN_I2C_SDA 8
#define PIN_I2C_SCL 9

// NEO-6M GPS (UART1) — module TX -> ESP32 RX, module RX -> ESP32 TX
#define PIN_GPS_RX 18
#define PIN_GPS_TX 17

// A7670C LTE/GSM modem (UART2)
#define PIN_MODEM_RX 16
#define PIN_MODEM_TX 15
#define PIN_MODEM_POWER 7 // PWRKEY / power-enable pin, -1 if not wired

// MAX6675 thermocouple amplifier (SPI, read-only)
#define PIN_MAX6675_SCK 12
#define PIN_MAX6675_CS 11
#define PIN_MAX6675_SO 13

// MicroSD card module (SPI, shares bus with MAX6675 where possible)
#define PIN_SD_CS 34
#define PIN_SD_MOSI 35
#define PIN_SD_MISO 37
#define PIN_SD_SCK 36

// ACS712 current sensor (analog)
#define PIN_ACS712 4
#define ACS712_MV_PER_AMP 185.0f // 185 for 5A variant, 100 for 20A, 66 for 30A
#define ACS712_ZERO_VOLTAGE 1650.0f // calibrate: no-load output, in mV, at 3.3V logic

// SW-420 vibration sensor (digital, active depends on module's comparator)
#define PIN_SW420 5

// Status LED (optional, onboard or external)
#define PIN_STATUS_LED 2
