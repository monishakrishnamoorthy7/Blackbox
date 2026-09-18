import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "../services/api.js";
import { getSocket } from "../services/socket.js";

import {
  CHART_POINTS,
  CHENNAI_CENTER,
  DEVICE_ID,
  SOS_COUNTDOWN_SECONDS,
  TELEMETRY_STALE_MS,
} from "../config.js";

import { hasGpsFix, impactMagnitude } from "../utils/format.js";

const DashboardContext = createContext(null);
const EmergencyContext = createContext(null);

/* =========================================================
   CHART
========================================================= */

function pushChartPoint(points, next) {
  const row = {
    time: new Date(
      next.timestamp || Date.now()
    ).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),

    speed: Number(next.speed || 0),

    accelX: Number(next.acceleration?.x || 0),
    accelY: Number(next.acceleration?.y || 0),
    accelZ: Number(next.acceleration?.z || 0),

    impact: impactMagnitude(next.acceleration),

    gyroX: Number(next.gyroscope?.x || 0),
    gyroY: Number(next.gyroscope?.y || 0),
    gyroZ: Number(next.gyroscope?.z || 0),

    temperature: Number(next.temperature || 0),
    current: Number(next.current || 0),
  };

  const merged = [...points, row];

  return merged.slice(-CHART_POINTS);
}

/* =========================================================
   EVENTS
========================================================= */

function toEvent(type, message, extra = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,

    type,
    message,
    at: new Date().toISOString(),

    ...extra,
  };
}

/* =========================================================
   PROVIDER
========================================================= */

export function DashboardProvider({ children }) {
  const [view, setView] = useState("dashboard");

  const [backendOnline, setBackendOnline] = useState(false);
  const [backendError, setBackendError] = useState(
    "Connecting to backend…"
  );

  const [socketConnected, setSocketConnected] = useState(false);

  const [telemetry, setTelemetry] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [chartPoints, setChartPoints] = useState([]);

  const [accidents, setAccidents] = useState([]);
  const [emergencyEvents, setEmergencyEvents] = useState([]);
  const [events, setEvents] = useState([]);

  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [now, setNow] = useState(new Date());

  const [activeAlert, setActiveAlert] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [alertOutcome, setAlertOutcome] = useState(null);
  const [sosToastVisible, setSosToastVisible] = useState(false);

  const [accidentState, setAccidentState] = useState("NORMAL");

  const [simulateBusy, setSimulateBusy] = useState(false);
  const [simulateError, setSimulateError] = useState("");

  /*
   * IMPORTANT:
   *
   * Keep a simulator object available even when the external
   * simulator process is unavailable.
   *
   * This allows the dashboard to run in local/demo mode.
   */
  const [simulator, setSimulator] = useState({
    id: DEVICE_ID,
    running: false,
    gpsState: "fix",
    mode: "local-demo",
    connected: true,
  });

  const [simulatorError, setSimulatorError] = useState("");

  const [manualSosBusy, setManualSosBusy] = useState(false);

  const lastGpsStatus = useRef(null);
  const countdownRef = useRef(null);

  /*
   * Local simulator interval.
   */
  const simulatorTimerRef = useRef(null);

  /*
   * Simulated GPS coordinates.
   */
  const simulatorPositionRef = useRef({
    latitude: CHENNAI_CENTER.latitude,
    longitude: CHENNAI_CENTER.longitude,
  });

  /*
   * Simulated speed.
   */
  const simulatorSpeedRef = useRef(18);

  /* =========================================================
     EVENTS
  ========================================================= */

  const addEvent = useCallback((type, message, extra) => {
    setEvents((prev) =>
      [toEvent(type, message, extra), ...prev].slice(0, 40)
    );
  }, []);

  /* =========================================================
     TELEMETRY
  ========================================================= */

  const ingestTelemetry = useCallback(
    (doc) => {
      if (!doc) return;

      if (
        doc.deviceId &&
        doc.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const gpsStatus =
        doc.gps?.status || "unknown";

      if (
        lastGpsStatus.current &&
        lastGpsStatus.current !== gpsStatus
      ) {
        addEvent(
          "gps",
          `GPS status changed: ${lastGpsStatus.current} → ${gpsStatus}`
        );
      }

      lastGpsStatus.current = gpsStatus;

      setTelemetry(doc);
      setLastSeenAt(Date.now());

      if (
        doc.gps?.latitude != null &&
        doc.gps?.longitude != null
      ) {
        setLocationHistory((points) =>
          [
            ...points,
            {
              latitude: Number(
                doc.gps.latitude
              ),

              longitude: Number(
                doc.gps.longitude
              ),

              status: gpsStatus,

              speed: Number(
                doc.speed || 0
              ),

              course: Number(
                doc.gps.course || 0
              ),

              timestamp:
                doc.timestamp ||
                new Date().toISOString(),
            },
          ].slice(-80)
        );
      }

      setChartPoints((points) =>
        pushChartPoint(points, doc)
      );
    },
    [addEvent]
  );

  /* =========================================================
     LOCAL SIMULATOR TELEMETRY
  ========================================================= */

  const generateSimulatorTelemetry =
    useCallback(() => {
      const simulatorState = simulator;

      if (!simulatorState?.running) {
        return;
      }

      /*
       * Slightly vary speed to make the dashboard look live.
       */
      const speedVariation =
        (Math.random() - 0.5) * 2;

      simulatorSpeedRef.current =
        Math.max(
          8,
          Math.min(
            45,
            simulatorSpeedRef.current +
              speedVariation
          )
        );

      /*
       * Move the simulated bike slightly.
       */
      simulatorPositionRef.current.latitude +=
        0.00003;

      simulatorPositionRef.current.longitude +=
        0.00002;

      const gpsLost =
        simulatorState.gpsState === "lost";

      const payload = {
        deviceId: DEVICE_ID,

        timestamp:
          new Date().toISOString(),

        speed:
          Number(
            simulatorSpeedRef.current.toFixed(1)
          ),

        acceleration: {
          x: Number(
            (0.4 + Math.random() * 0.4).toFixed(2)
          ),

          y: Number(
            (0.2 + Math.random() * 0.3).toFixed(2)
          ),

          z: Number(
            (9.6 + Math.random() * 0.3).toFixed(2)
          ),
        },

        gyroscope: {
          x: Number(
            (Math.random() * 4).toFixed(2)
          ),

          y: Number(
            (Math.random() * 4).toFixed(2)
          ),

          z: Number(
            (Math.random() * 4).toFixed(2)
          ),
        },

        leanAngle: Number(
          (Math.random() * 8).toFixed(1)
        ),

        temperature: Number(
          (34 + Math.random() * 5).toFixed(1)
        ),

        current: Number(
          (1.5 + Math.random() * 0.8).toFixed(2)
        ),

        vibration: false,

        gps: gpsLost
          ? {
              latitude:
                simulatorPositionRef.current
                  .latitude,

              longitude:
                simulatorPositionRef.current
                  .longitude,

              speed:
                simulatorSpeedRef.current,

              course: 90,

              status: "lost",
            }
          : {
              latitude:
                simulatorPositionRef.current
                  .latitude,

              longitude:
                simulatorPositionRef.current
                  .longitude,

              speed:
                simulatorSpeedRef.current,

              course: 90,

              status: "fix",
            },

        networkStatus: "online",

        accidentStatus: "normal",

        simulator: true,

        source: "local-demo-simulator",
      };

      /*
       * Update the React dashboard immediately.
       */
      ingestTelemetry(payload);

      /*
       * Also send telemetry to the real backend.
       *
       * This keeps backend history and Socket.IO-based
       * dashboard features working when available.
       */
      fetch("http://localhost:4000/api/telemetry", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }).catch(() => {
        /*
         * Local simulation continues even if the backend
         * telemetry endpoint is temporarily unavailable.
         */
      });
    }, [ingestTelemetry, simulator]);

  /* =========================================================
     START LOCAL SIMULATOR
  ========================================================= */

  const startLocalSimulator =
    useCallback(() => {
      if (simulatorTimerRef.current) {
        clearInterval(
          simulatorTimerRef.current
        );
      }

      setSimulator({
        id: DEVICE_ID,
        running: true,
        gpsState: "fix",
        mode: "local-demo",
        connected: true,
      });

      setSimulatorError("");

      addEvent(
        "system",
        "Local simulator started"
      );

      /*
       * First telemetry immediately.
       */
      setTimeout(() => {
        generateSimulatorTelemetry();
      }, 100);

      /*
       * Continue telemetry every 1.5 seconds.
       */
      simulatorTimerRef.current =
        setInterval(() => {
          generateSimulatorTelemetry();
        }, 1500);
    }, [
      addEvent,
      generateSimulatorTelemetry,
    ]);

  /* =========================================================
     STOP LOCAL SIMULATOR
  ========================================================= */

  const stopLocalSimulator =
    useCallback(() => {
      if (simulatorTimerRef.current) {
        clearInterval(
          simulatorTimerRef.current
        );

        simulatorTimerRef.current = null;
      }

      setSimulator((current) => ({
        ...current,
        running: false,
        connected: true,
      }));

      addEvent(
        "system",
        "Local simulator stopped"
      );
    }, [addEvent]);

  /* =========================================================
     ALERT FLOW
  ========================================================= */

  const startAlertFlow = useCallback(
    (alert, telemetrySnapshot) => {
      if (!alert) return;

      if (countdownRef.current) {
        clearInterval(
          countdownRef.current
        );

        countdownRef.current = null;
      }

      setActiveAlert({
        alert,
        telemetry:
          telemetrySnapshot || null,
      });

      setAlertOutcome(null);
      setSosToastVisible(false);

      setAccidentState("COUNTDOWN");

      setCountdown(
        SOS_COUNTDOWN_SECONDS
      );

      addEvent(
        "accident",
        `Accident alert received (${
          alert.severity || "high"
        })`
      );

      countdownRef.current =
        setInterval(() => {
          setCountdown((value) => {
            if (value === null) {
              return null;
            }

            if (value <= 1) {
              clearInterval(
                countdownRef.current
              );

              countdownRef.current = null;

              setAlertOutcome("sos");
              setAccidentState(
                "SOS_TRIGGERED"
              );

              setActiveAlert(null);

              addEvent(
                "sos",
                "SOS TRIGGERED — emergency dispatch sequence started"
              );

              api
                .postEmergencySOS({
                  ...alert,
                  telemetry:
                    telemetrySnapshot ||
                    null,
                  deviceId:
                    alert.deviceId,
                })
                .then((result) => {
                  if (result?.data) {
                    setEmergencyEvents(
                      (previous) =>
                        [
                          result.data,
                          ...previous,
                        ].slice(0, 50)
                    );
                  }
                })
                .catch((error) =>
                  addEvent(
                    "system",
                    `SOS persistence error: ${error.message}`
                  )
                );

              return 0;
            }

            return value - 1;
          });
        }, 1000);
    },
    [addEvent]
  );

  /* =========================================================
     CANCEL ALERT
  ========================================================= */

  const cancelAlert = useCallback(() => {
    const alert =
      activeAlert?.alert;

    const telemetrySnapshot =
      activeAlert?.telemetry;

    if (countdownRef.current) {
      clearInterval(
        countdownRef.current
      );

      countdownRef.current = null;
    }

    setActiveAlert(null);
    setCountdown(null);

    setAlertOutcome("cancelled");
    setSosToastVisible(false);

    setAccidentState("CANCELLED");

    addEvent(
      "sos",
      "False Alarm / Alert Cancelled"
    );

    if (alert) {
      api
        .cancelEmergency({
          ...alert,
          telemetry:
            telemetrySnapshot,
          deviceId:
            alert.deviceId,
        })
        .then((result) => {
          if (result?.data) {
            setEmergencyEvents(
              (previous) =>
                [
                  result.data,
                  ...previous,
                ].slice(0, 50)
            );
          }
        })
        .catch((error) =>
          addEvent(
            "system",
            `Cancellation persistence error: ${error.message}`
          )
        );
    }
  }, [activeAlert, addEvent]);

  /* =========================================================
     CLOCK
  ========================================================= */

  useEffect(() => {
    const clock = setInterval(
      () => setNow(new Date()),
      1000
    );

    return () => clearInterval(clock);
  }, []);

  /* =========================================================
     BACKEND + DATA REFRESH
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const health =
          await api.getHealth();

        if (cancelled) return;

        setBackendOnline(
          Boolean(health?.ok) ||
            health?.database ===
              "connected" ||
            Boolean(health)
        );

        setBackendError(
          health?.database ===
            "disconnected"
            ? "API up, Neon disconnected"
            : ""
        );

        if (
          health &&
          health.ok === false &&
          health.database ===
            "disconnected"
        ) {
          setBackendOnline(true);
        }
      } catch (error) {
        if (cancelled) return;

        const databaseOffline =
          error.status === 503 &&
          (
            error.body?.database ===
              "disconnected" ||
            error.body?.error ===
              "Database is not connected"
          );

        setBackendOnline(
          databaseOffline
        );

        setBackendError(
          databaseOffline
            ? "Neon disconnected; using API memory buffer"
            : error.message ||
              "Backend unavailable"
        );
      }

      try {
        const [
          latest,
          history,
          accidentList,
          emergencyList,
        ] = await Promise.all([
          api.getLatestTelemetry(
            DEVICE_ID
          ),

          api.getTelemetry(
            DEVICE_ID,
            CHART_POINTS
          ),

          api.getAccidents(
            DEVICE_ID,
            30
          ),

          api.getEmergencyEvents(
            DEVICE_ID,
            30
          ),
        ]);

        if (cancelled) return;

        if (latest?.data) {
          ingestTelemetry(
            latest.data
          );
        }

        if (
          Array.isArray(history?.data)
        ) {
          const chronological =
            [...history.data].reverse();

          setLocationHistory(
            chronological
              .filter(
                (item) =>
                  item.gps?.latitude !=
                    null &&
                  item.gps?.longitude !=
                    null
              )
              .map((item) => ({
                latitude: Number(
                  item.gps.latitude
                ),

                longitude: Number(
                  item.gps.longitude
                ),

                status:
                  item.gps.status ||
                  "unknown",

                speed: Number(
                  item.speed || 0
                ),

                course: Number(
                  item.gps.course || 0
                ),

                timestamp:
                  item.timestamp ||
                  new Date().toISOString(),
              }))
              .slice(-80)
          );

          setChartPoints(
            chronological.reduce(
              (acc, item) =>
                pushChartPoint(
                  acc,
                  item
                ),
              []
            )
          );
        }

        if (
          Array.isArray(
            accidentList?.data
          )
        ) {
          setAccidents(
            accidentList.data
          );
        }

        if (
          Array.isArray(
            emergencyList?.data
          )
        ) {
          setEmergencyEvents(
            emergencyList.data
          );
        }
      } catch {
        /*
         * Backend data errors do not stop
         * the local simulator.
         */
      }
    }

    refresh();

    const poll = setInterval(
      refresh,
      8000
    );

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [ingestTelemetry]);

  /* =========================================================
     SIMULATOR STATUS
  ========================================================= */

  const refreshSimulator =
    useCallback(async () => {
      try {
        const result =
          await api.getSimulatorStatus();

        if (result?.data) {
          setSimulator((current) => ({
            ...current,
            ...result.data,
            connected: true,
          }));
        }

        setSimulatorError("");
      } catch {
        /*
         * IMPORTANT:
         *
         * Do NOT set simulator to null.
         *
         * If the external simulator process is unavailable,
         * continue using our local simulator.
         */
        setSimulator((current) => ({
          ...current,

          id:
            current?.id ||
            DEVICE_ID,

          running:
            current?.running ||
            false,

          gpsState:
            current?.gpsState ||
            "fix",

          mode:
            current?.mode ||
            "local-demo",

          connected: true,
        }));

        setSimulatorError("");
      }
    }, []);

  useEffect(() => {
    refreshSimulator();

    const poll = setInterval(
      refreshSimulator,
      5000
    );

    return () => {
      clearInterval(poll);
    };
  }, [refreshSimulator]);

  /* =========================================================
     CONTROL SIMULATOR
  ========================================================= */

  const controlSimulator =
    useCallback(
      async (command) => {
        setSimulatorError("");

        /*
         * First try the real backend simulator.
         */
        try {
          const result =
            await api.controlSimulator(
              command
            );

          setSimulator((current) => ({
            ...current,

            ...(result?.data || {}),

            connected: true,
          }));

          /*
           * If backend start succeeded,
           * do not need local fallback.
           */
          return result;
        } catch (error) {
          /*
           * Backend simulator unavailable.
           *
           * Fall back to local browser simulator.
           */
        }

        /*
         * LOCAL FALLBACK
         */

        if (command === "start") {
          startLocalSimulator();

          return {
            ok: true,

            data: {
              id: DEVICE_ID,
              running: true,
              gpsState: "fix",
              mode: "local-demo",
              connected: true,
            },
          };
        }

        if (command === "stop") {
          stopLocalSimulator();

          return {
            ok: true,

            data: {
              running: false,
              gpsState:
                simulator?.gpsState ||
                "fix",

              mode: "local-demo",
              connected: true,
            },
          };
        }

        if (command === "gps-lost") {
          setSimulator((current) => ({
            ...current,

            gpsState: "lost",
            connected: true,
          }));

          addEvent(
            "gps",
            "Simulator GPS loss activated"
          );

          return {
            ok: true,

            data: {
              gpsState: "lost",
            },
          };
        }

        if (
          command === "gps-restore"
        ) {
          setSimulator((current) => ({
            ...current,

            gpsState: "fix",
            connected: true,
          }));

          addEvent(
            "gps",
            "Simulator GPS restored"
          );

          return {
            ok: true,

            data: {
              gpsState: "fix",
            },
          };
        }

        if (command === "accident") {
          /*
           * Create a realistic accident
           * directly through the backend.
           */
          const source =
            telemetry || {};

          const payload = {
            deviceId: DEVICE_ID,

            timestamp:
              new Date().toISOString(),

            speed: Number(
              source.speed ?? 28
            ),

            acceleration: {
              x: 8.4,
              y: 9.1,
              z: 3.2,
            },

            gyroscope: {
              x: 32,
              y: 18,
              z: 11,
            },

            leanAngle: Number(
              source.leanAngle ??
                54
            ),

            temperature: Number(
              source.temperature ??
                38
            ),

            current: Number(
              source.current ?? 2.1
            ),

            vibration: true,

            gps: {
              latitude:
                source.gps?.latitude ??
                CHENNAI_CENTER.latitude,

              longitude:
                source.gps?.longitude ??
                CHENNAI_CENTER.longitude,

              speed: Number(
                source.gps?.speed ??
                  source.speed ??
                  28
              ),

              course: Number(
                source.gps?.course ??
                  90
              ),

              status:
                simulator?.gpsState ===
                "lost"
                  ? "lost"
                  : "fix",
            },

            networkStatus: "online",

            accidentStatus:
              "accident",

            severity:
              "critical",

            source:
              "local-demo-simulator",

            message:
              "Simulator accident sequence",
          };

          try {
            const result =
              await api.postAccident(
                payload
              );

            const alert =
              result?.data?.alert;

            const linked =
              result?.data?.telemetry;

            if (
              alert &&
              !socketConnected
            ) {
              setAccidents(
                (prev) =>
                  [
                    alert,
                    ...prev,
                  ].slice(0, 50)
              );

              startAlertFlow(
                alert,
                linked
              );
            }

            return result;
          } catch (error) {
            setSimulateError(
              error.message ||
                "Accident API failed"
            );

            throw error;
          }
        }

        throw new Error(
          `Unknown simulator command: ${command}`
        );
      },
      [
        addEvent,
        simulator,
        socketConnected,
        startAlertFlow,
        startLocalSimulator,
        stopLocalSimulator,
        telemetry,
      ]
    );

  /* =========================================================
     SOCKET.IO
  ========================================================= */

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setSocketConnected(true);

      addEvent(
        "system",
        "Socket.IO connected"
      );

      socket.emit(
        "device:join",
        DEVICE_ID
      );
    };

    const onDisconnect = () => {
      setSocketConnected(false);

      addEvent(
        "system",
        "Socket.IO disconnected"
      );
    };

    const onTelemetry = (doc) =>
      ingestTelemetry(doc);

    const onSuspected = (payload) => {
      setAccidentState(
        "SUSPECTED"
      );

      addEvent(
        "accident",
        `Suspected impact (${
          payload.triggeredSignals?.join(
            ", "
          ) ||
          "sensor signal"
        })`
      );
    };

    const onConfirmed = (payload) => {
      setAccidentState(
        "CONFIRMED"
      );

      addEvent(
        "accident",
        `Accident confirmed (${
          payload.confidence ||
          0
        }% confidence)`
      );
    };

    const onCountdown = () =>
      setAccidentState(
        "COUNTDOWN"
      );

    const onCancelled = (event) => {
      setAccidentState(
        "CANCELLED"
      );

      setAlertOutcome(
        "cancelled"
      );

      setSosToastVisible(
        false
      );

      setEmergencyEvents(
        (previous) =>
          [
            event,
            ...previous,
          ].slice(0, 50)
      );
    };

    const onEmergency = (event) => {
      setAccidentState(
        "SOS_TRIGGERED"
      );

      setAlertOutcome("sos");

      setSosToastVisible(
        true
      );

      setActiveAlert(null);

      setEmergencyEvents(
        (previous) =>
          [
            event,
            ...previous,
          ].slice(0, 50)
      );

      addEvent(
        "sos",
        event.type ===
          "MANUAL_SOS"
          ? "Manual SOS triggered"
          : "SOS TRIGGERED — A7670C interface ready"
      );
    };

    const onAccident = (
      payload
    ) => {
      const alert =
        payload?.alert ||
        payload;

      const linkedTelemetry =
        payload?.telemetry ||
        null;

      setAccidents(
        (prev) =>
          [
            alert,
            ...prev,
          ].slice(0, 50)
      );

      startAlertFlow(
        alert,
        linkedTelemetry
      );
    };

    const onBlockchainStatus =
      (payload) => {
        setAccidents(
          (previous) =>
            previous.map(
              (accident) =>
                String(
                  accident._id
                ) ===
                String(
                  payload.accidentId
                )
                  ? {
                      ...accident,

                      blockchainStatus:
                        payload.status,

                      evidenceHash:
                        payload.evidenceHash,

                      blockchainReference:
                        payload.blockchainReference,

                      blockchainRecordedAt:
                        payload.recordedAt,
                    }
                  : accident
            )
        );
      };

    socket.on(
      "connect",
      onConnect
    );

    socket.on(
      "disconnect",
      onDisconnect
    );

    socket.on(
      "telemetry:update",
      onTelemetry
    );

    socket.on(
      "accident:suspected",
      onSuspected
    );

    socket.on(
      "accident:confirmed",
      onConfirmed
    );

    socket.on(
      "accident:countdown",
      onCountdown
    );

    socket.on(
      "accident:cancelled",
      onCancelled
    );

    socket.on(
      "emergency:sos",
      onEmergency
    );

    socket.on(
      "emergency:manual",
      onEmergency
    );

    socket.on(
      "accident:alert",
      onAccident
    );

    socket.on(
      "accident:blockchain-status",
      onBlockchainStatus
    );

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off(
        "connect",
        onConnect
      );

      socket.off(
        "disconnect",
        onDisconnect
      );

      socket.off(
        "telemetry:update",
        onTelemetry
      );

      socket.off(
        "accident:suspected",
        onSuspected
      );

      socket.off(
        "accident:confirmed",
        onConfirmed
      );

      socket.off(
        "accident:countdown",
        onCountdown
      );

      socket.off(
        "accident:cancelled",
        onCancelled
      );

      socket.off(
        "emergency:sos",
        onEmergency
      );

      socket.off(
        "emergency:manual",
        onEmergency
      );

      socket.off(
        "accident:alert",
        onAccident
      );

      socket.off(
        "accident:blockchain-status",
        onBlockchainStatus
      );
    };
  }, [
    addEvent,
    ingestTelemetry,
    startAlertFlow,
  ]);

  /* =========================================================
     CLEANUP LOCAL SIMULATOR
  ========================================================= */

  useEffect(() => {
    return () => {
      if (
        simulatorTimerRef.current
      ) {
        clearInterval(
          simulatorTimerRef.current
        );
      }

      if (
        countdownRef.current
      ) {
        clearInterval(
          countdownRef.current
        );
      }
    };
  }, []);

  /* =========================================================
     DIRECT DASHBOARD ACCIDENT SIMULATION
  ========================================================= */

  const simulateAccident =
    useCallback(async () => {
      setSimulateBusy(true);
      setSimulateError("");

      const source =
        telemetry || {};

      const payload = {
        deviceId: DEVICE_ID,

        timestamp:
          new Date().toISOString(),

        speed: Number(
          source.speed ?? 18
        ),

        acceleration:
          source.acceleration || {
            x: 8.4,
            y: 9.1,
            z: 3.2,
          },

        gyroscope:
          source.gyroscope || {
            x: 32,
            y: 18,
            z: 11,
          },

        leanAngle: Number(
          source.leanAngle ?? 54
        ),

        temperature: Number(
          source.temperature ?? 38
        ),

        current: Number(
          source.current ?? 2.1
        ),

        vibration: true,

        gps: {
          latitude:
            hasGpsFix(source)
              ? source.gps.latitude
              : CHENNAI_CENTER.latitude,

          longitude:
            hasGpsFix(source)
              ? source.gps.longitude
              : CHENNAI_CENTER.longitude,

          speed: Number(
            source.gps?.speed ??
              source.speed ??
              18
          ),

          course: Number(
            source.gps?.course ??
              0
          ),

          status:
            hasGpsFix(source)
              ? source.gps.status
              : "fix",
        },

        networkStatus:
          source.networkStatus ||
          "online",

        accidentStatus:
          "accident",

        severity:
          "critical",

        source:
          "dashboard-demo",

        message:
          "Dashboard SIMULATE ACCIDENT",
      };

      try {
        const result =
          await api.postAccident(
            payload
          );

        const alert =
          result?.data?.alert;

        const linked =
          result?.data?.telemetry;

        if (
          alert &&
          !socketConnected
        ) {
          setAccidents(
            (prev) =>
              [
                alert,
                ...prev,
              ].slice(0, 50)
          );

          startAlertFlow(
            alert,
            linked
          );
        }
      } catch (error) {
        setSimulateError(
          error.message ||
            "Accident API failed"
        );

        addEvent(
          "system",
          `Accident API error: ${error.message}`
        );
      } finally {
        setSimulateBusy(false);
      }
    }, [
      addEvent,
      socketConnected,
      startAlertFlow,
      telemetry,
    ]);

  /* =========================================================
     SIMULATOR ACCIDENT
  ========================================================= */

  const triggerSimulatorAccident =
    useCallback(async () => {
      setSimulateBusy(true);
      setSimulateError("");

      try {
        /*
         * If simulator isn't running,
         * start the local simulator first.
         */
        if (!simulator?.running) {
          startLocalSimulator();

          /*
           * Give telemetry a moment to start.
           */
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                300
              )
          );
        }

        await controlSimulator(
          "accident"
        );

        addEvent(
          "accident",
          "Simulator accident sequence started"
        );
      } catch (error) {
        setSimulateError(
          error.message ||
            "Simulator unavailable"
        );
      } finally {
        setSimulateBusy(false);
      }
    }, [
      addEvent,
      controlSimulator,
      simulator,
      startLocalSimulator,
    ]);

  /* =========================================================
     MANUAL SOS
  ========================================================= */

  const triggerManualSOS =
    useCallback(async () => {
      setManualSosBusy(true);

      try {
        const result =
          await api.postManualSOS({
            deviceId: DEVICE_ID,
          });

        if (result?.data) {
          setEmergencyEvents(
            (previous) =>
              [
                result.data,
                ...previous,
              ].slice(0, 50)
          );
        }

        return result;
      } finally {
        setManualSosBusy(false);
      }
    }, []);

  /* =========================================================
     DERIVED STATE
  ========================================================= */

  const telemetryFresh =
    Boolean(
      lastSeenAt &&
        Date.now() -
          lastSeenAt <
          TELEMETRY_STALE_MS
    );

  const gpsOk =
    hasGpsFix(telemetry);

  /* =========================================================
     DASHBOARD CONTEXT VALUE
  ========================================================= */

  const value = useMemo(
    () => ({
      view,
      setView,

      now,

      backendOnline,
      backendError,

      socketConnected,

      telemetry,
      locationHistory,

      telemetryFresh,
      gpsOk,

      chartPoints,

      accidents,
      emergencyEvents,
      events,

      lastSeenAt,

      activeAlert,
      countdown,

      alertOutcome,
      accidentState,

      simulateBusy,
      simulateError,

      simulator,
      simulatorError,

      controlSimulator,

      simulateAccident,
      triggerSimulatorAccident,

      triggerManualSOS,
      manualSosBusy,

      cancelAlert,

      deviceId: DEVICE_ID,
    }),
    [
      accidents,
      emergencyEvents,
      activeAlert,
      alertOutcome,
      accidentState,

      backendError,
      backendOnline,

      cancelAlert,

      chartPoints,
      countdown,

      events,

      gpsOk,
      lastSeenAt,

      now,
      locationHistory,

      simulateAccident,
      triggerSimulatorAccident,

      triggerManualSOS,
      manualSosBusy,

      simulateBusy,
      simulateError,

      simulator,
      simulatorError,

      controlSimulator,

      socketConnected,
      telemetry,
      telemetryFresh,

      view,
    ]
  );

  /* =========================================================
     EMERGENCY CONTEXT
  ========================================================= */

  const emergencyValue =
    useMemo(
      () => ({
        activeAlert,
        countdown,

        cancelAlert,

        alertOutcome,

        accidentState,

        sosToastVisible,

        dismissSosToast: () =>
          setSosToastVisible(false),
      }),
      [
        activeAlert,
        countdown,
        cancelAlert,
        alertOutcome,
        accidentState,
        sosToastVisible,
      ]
    );

  /* =========================================================
     PROVIDERS
  ========================================================= */

  return (
    <DashboardContext.Provider
      value={value}
    >
      <EmergencyContext.Provider
        value={emergencyValue}
      >
        {children}
      </EmergencyContext.Provider>
    </DashboardContext.Provider>
  );
}

/* =========================================================
   HOOKS
========================================================= */

export function useDashboard() {
  const context =
    useContext(
      DashboardContext
    );

  if (!context) {
    throw new Error(
      "useDashboard must be used inside DashboardProvider"
    );
  }

  return context;
}

export function useEmergency() {
  const context =
    useContext(
      EmergencyContext
    );

  if (!context) {
    throw new Error(
      "useEmergency must be used inside DashboardProvider"
    );
  }

  return context;
}