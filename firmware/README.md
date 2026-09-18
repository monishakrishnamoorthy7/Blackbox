# Bike Black Box — ESP32-S3 Firmware

Real hardware implementation of the device this project's backend and
dashboard were built for. It speaks the exact same HTTP contract as the Node
simulator (`../simulator`), so the backend and dashboard need zero code
changes to accept it — point it at your backend's LAN address and it just
works.

```
Sensors -> ESP32-S3 -> POST /api/telemetry (Wi-Fi, HTTP/JSON) -> Backend -> Dashboard
                     -> POST /api/accidents (on local detection)
                     -> MicroSD (buffers telemetry when offline)
                     -> A7670C modem (real SMS/voice SOS, independent of Wi-Fi)
```

## Why the ESP32 also runs its own accident detection

The backend already detects accidents from the telemetry stream
(`backend/src/services/accidentDetectionService.js`) and drives the
dashboard's suspected → confirmed → countdown → SOS flow. You do not need
anything below for the dashboard to work — streaming telemetry is enough.

The one thing the backend server cannot do is physically call or text
someone: it has no cellular modem, and `sendEmergencySOS()` on that side is a
log-only simulation by design. Only this firmware, with an A7670C attached
and a SIM inserted, can place a real SOS — and it needs to be able to do that
even if Wi-Fi or the backend is unreachable. So `AccidentDetector` on-device
is a deliberately duplicated, independent copy of the backend's thresholds,
used only to decide when to fire the modem.

## Hardware / wiring

Board: **ESP32-S3-DevKitC-1**. Default pins are in
`include/config.example.h` — change them to match your actual wiring, then
copy the file (see Setup below).

| Sensor | Interface | Default pins |
|---|---|---|
| MPU6050 (accel/gyro) | I2C | SDA `8`, SCL `9` |
| NEO-6M GPS | UART1 | RX `18` ← GPS TX, TX `17` → GPS RX |
| A7670C LTE/GSM modem | UART2 | RX `16` ← modem TX, TX `15` → modem RX, PWRKEY `7` |
| MAX6675 thermocouple amp | SPI (read-only) | SCK `12`, CS `11`, SO `13` |
| MicroSD module | SPI | SCK `36`, MISO `37`, MOSI `35`, CS `34` |
| ACS712 current sensor | Analog (ADC1) | `4` |
| SW-420 vibration sensor | Digital | `5` |
| Status LED | Digital out | `2` |

Notes:
- `ACS712_MV_PER_AMP` in the config must match your module variant (5A/20A/30A) and `ACS712_ZERO_VOLTAGE` should be calibrated against your board's actual no-load output — don't trust the datasheet number blindly.
- The lean-angle formula in `SensorHub::readLeanAngleDeg` assumes the MPU6050's Y axis points along the direction of travel. If your IMU is mounted a different way, remap the axes there.
- `PIN_MODEM_POWER` set to `-1` in config disables the PWRKEY toggle if your A7670C board doesn't expose one.

## Setup

1. Install [PlatformIO](https://platformio.org/install/cli) (CLI or the VS Code extension).
2. Copy the config template and fill in your values:
   ```bash
   cp include/config.example.h include/config.h
   ```
   Set `WIFI_SSID`, `WIFI_PASSWORD`, `API_BASE_URL` (your backend's **LAN IP**, not `localhost`), `DEVICE_ID` (must match what the dashboard is watching, default `BBX-SIM-001`), and `EMERGENCY_PHONE_NUMBER` (leave blank to disable modem SOS and rely on the dashboard/manual flow only).
3. Build:
   ```bash
   pio run
   ```
4. Flash over USB:
   ```bash
   pio run --target upload
   ```
5. Watch logs:
   ```bash
   pio device monitor
   ```

## Project layout

```
firmware/
├── platformio.ini
├── include/
│   ├── config.example.h   # copy to config.h, gitignored
│   ├── Telemetry.h        # shared struct, matches backend JSON contract
│   ├── SensorHub.h
│   ├── AccidentDetector.h
│   ├── TelemetryClient.h
│   ├── CellularSOS.h
│   └── SdLogger.h
└── src/
    ├── main.cpp
    ├── SensorHub.cpp       # reads MPU6050 / GPS / MAX6675 / ACS712 / SW-420
    ├── AccidentDetector.cpp
    ├── TelemetryClient.cpp # Wi-Fi + HTTP POST + JSON, SD fallback queue
    ├── CellularSOS.cpp     # A7670C AT-command SMS/voice dispatch
    └── SdLogger.cpp        # append-only offline queue on MicroSD
```

## Swapping in the simulator vs. this firmware

They're interchangeable — same `deviceId`, same endpoints, same JSON shape.
Run the Node simulator when you want to demo the dashboard without hardware;
run this firmware once your sensors are wired up. Both can even point at the
same backend, as long as they don't share a `deviceId`.
