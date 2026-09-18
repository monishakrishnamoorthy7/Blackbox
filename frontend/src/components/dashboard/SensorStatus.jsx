import { useDashboard } from "../../context/DashboardContext.jsx";

export default function SensorStatus() {
  const {
    telemetry,
    socketConnected,
    backendOnline,
  } = useDashboard();

  /*
   * DEMO MODE
   * ----------
   * Hardware sensors are not physically connected yet.
   * This allows the dashboard to demonstrate the complete
   * Bike Black Box system without waiting for ESP32 telemetry.
   *
   * When the real ESP32 is connected, change this to false
   * and the cards can return to real sensor-based status.
   */
  const DEMO_MODE = true;

  const vibrationDetected = telemetry?.vibration === true;

  const sensors = [
    {
      name: "MPU6050",
      detail: "IMU / lean / impact",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "NEO-6M GPS",
      detail: "GPS position lock",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "MAX6675",
      detail: "Temperature sensor",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "ACS712",
      detail: "Current sensing",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "SW-420",
      detail: vibrationDetected
        ? "VIBRATION DETECTED"
        : "NORMAL / NO VIBRATION",
      state: DEMO_MODE
        ? "Online"
        : getRealState(),
    },
    {
      name: "A7670C",
      detail: "Cellular / network",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "MicroSD",
      detail: "Local black-box storage",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
    {
      name: "ESP32-S3",
      detail: "Edge controller",
      state: DEMO_MODE ? "Online" : getRealState(),
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">

        <div>
          <h2 className="text-sm font-semibold text-white">
            Sensor Status
          </h2>

          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
            {DEMO_MODE
              ? "Demo hardware simulation"
              : "Live hardware monitoring"}
          </p>
        </div>

        {/* Overall status */}
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5">

          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

          <span className="text-[11px] font-semibold text-emerald-300">
            SYSTEM ONLINE
          </span>

        </div>
      </div>

      {/* Sensor cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">

        {sensors.map((sensor) => (
          <div
            key={sensor.name}
            className="rounded-xl border border-slate-800 bg-[#0b1220] p-3 transition hover:border-emerald-400/30"
          >

            {/* Sensor name + indicator */}
            <div className="mb-2 flex items-center justify-between gap-2">

              <p className="text-sm font-medium text-white">
                {sensor.name}
              </p>

              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  sensor.state === "Online"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : sensor.state === "Warning"
                    ? "bg-amber-400"
                    : "bg-red-500"
                }`}
              />

            </div>

            {/* Sensor description */}
            <p className="text-[11px] leading-5 text-slate-500">
              {sensor.detail}
            </p>

            {/* Status */}
            <p
              className={`mt-2 text-xs font-semibold ${
                sensor.state === "Online"
                  ? "text-emerald-300"
                  : sensor.state === "Warning"
                  ? "text-amber-300"
                  : "text-red-300"
              }`}
            >
              {sensor.state}
            </p>

          </div>
        ))}

      </div>

      {/* Demo mode notice */}
      {DEMO_MODE && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-2">

          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

          <p className="text-[10px] text-slate-500">
            Demo Mode: sensor availability is simulated until the
            ESP32-S3 hardware is connected.
          </p>

        </div>
      )}

    </section>
  );
}

/*
 * Real hardware status placeholder.
 *
 * Once the ESP32-S3 starts sending individual sensor health
 * information, this function can be replaced with the actual
 * sensor-specific status logic.
 */
function getRealState() {
  return "Offline";
}