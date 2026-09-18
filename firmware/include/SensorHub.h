// Reads every onboard sensor and fills a Telemetry snapshot.
#pragma once
#include <Adafruit_MPU6050.h>
#include <TinyGPSPlus.h>
#include <max6675.h>
#include "Telemetry.h"

class SensorHub {
 public:
  bool begin();
  // Pumps the GPS UART; call every loop() iteration, not just once per sample.
  void pumpGps();
  // Takes a fresh reading from every sensor into `out`.
  void sample(Telemetry &out);

 private:
  Adafruit_MPU6050 mpu;
  MAX6675 *thermocouple = nullptr;
  TinyGPSPlus gps;
  HardwareSerial gpsSerial{1};
  bool mpuReady = false;

  float readLeanAngleDeg(const sensors_event_t &accel);
  float readCurrentAmps();
  bool readVibration();
};
