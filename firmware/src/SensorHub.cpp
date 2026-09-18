#include "SensorHub.h"
#include "config.h"
#include <Wire.h>
#include <math.h>

bool SensorHub::begin() {
  pinMode(PIN_SW420, INPUT);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  mpuReady = mpu.begin();
  if (mpuReady) {
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);
  } else {
    Serial.println("[SensorHub] MPU6050 not found — check wiring/I2C address");
  }

  thermocouple = new MAX6675(PIN_MAX6675_SCK, PIN_MAX6675_CS, PIN_MAX6675_SO);

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);

  analogReadResolution(12); // ESP32-S3 ADC: 0-4095 for 0-3.3V

  return mpuReady;
}

void SensorHub::pumpGps() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}

float SensorHub::readLeanAngleDeg(const sensors_event_t &accel) {
  // Roll angle from accelerometer, assuming the IMU's Y axis points along
  // the bike's direction of travel and X is the lean (left/right) axis.
  // Re-map axes here if your MPU6050 is mounted differently.
  float ax = accel.acceleration.x;
  float ay = accel.acceleration.y;
  float az = accel.acceleration.z;
  float roll = atan2(ax, sqrt(ay * ay + az * az)) * 180.0f / (float)M_PI;
  return roll;
}

float SensorHub::readCurrentAmps() {
  const int samples = 20;
  long total = 0;
  for (int i = 0; i < samples; i++) {
    total += analogRead(PIN_ACS712);
    delayMicroseconds(200);
  }
  float raw = (float)total / samples;
  float voltageMv = raw * (3300.0f / 4095.0f);
  return (voltageMv - ACS712_ZERO_VOLTAGE) / ACS712_MV_PER_AMP;
}

bool SensorHub::readVibration() {
  return digitalRead(PIN_SW420) == HIGH;
}

void SensorHub::sample(Telemetry &out) {
  out.millisAtSample = millis();

  if (mpuReady) {
    sensors_event_t accelEvent, gyroEvent, tempEvent;
    mpu.getEvent(&accelEvent, &gyroEvent, &tempEvent);
    out.acceleration = {accelEvent.acceleration.x, accelEvent.acceleration.y, accelEvent.acceleration.z};
    out.gyroscope = {
        gyroEvent.gyro.x * 180.0f / (float)M_PI,
        gyroEvent.gyro.y * 180.0f / (float)M_PI,
        gyroEvent.gyro.z * 180.0f / (float)M_PI,
    };
    out.leanAngleDeg = readLeanAngleDeg(accelEvent);
  } else {
    out.acceleration = {0, 0, 9.81f};
    out.gyroscope = {0, 0, 0};
    out.leanAngleDeg = 0;
  }

  out.temperatureC = thermocouple->readCelsius();
  out.currentAmps = readCurrentAmps();
  out.vibration = readVibration();

  pumpGps();
  if (gps.location.isValid() && gps.location.age() < 5000) {
    out.gps.valid = true;
    out.gps.latitude = gps.location.lat();
    out.gps.longitude = gps.location.lng();
    out.gps.speedKmh = gps.speed.isValid() ? gps.speed.kmph() : 0;
    out.gps.courseDeg = gps.course.isValid() ? gps.course.deg() : 0;
    out.speedKmh = out.gps.speedKmh;
  } else {
    out.gps.valid = false;
    out.speedKmh = 0;
  }
}
