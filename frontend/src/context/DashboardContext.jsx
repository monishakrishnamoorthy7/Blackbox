import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

function pushChartPoint(points, next) {
  const row = {
    time: new Date(next.timestamp || Date.now()).toLocaleTimeString(undefined, {
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

function toEvent(type, message, extra = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message,
    at: new Date().toISOString(),
    ...extra,
  };
}

export function DashboardProvider({ children }) {
  const [view, setView] = useState("dashboard");
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendError, setBackendError] = useState("Connecting to backend…");
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
  const [simulator, setSimulator] = useState(null);
  const [simulatorError, setSimulatorError] = useState("");
  const [manualSosBusy, setManualSosBusy] = useState(false);
  const lastGpsStatus = useRef(null);
  const countdownRef = useRef(null);

  const addEvent = useCallback((type, message, extra) => {
    setEvents((prev) => [toEvent(type, message, extra), ...prev].slice(0, 40));
  }, []);

  const ingestTelemetry = useCallback(
    (doc) => {
      if (!doc || (doc.deviceId && doc.deviceId !== DEVICE_ID)) return;
      const gpsStatus = doc.gps?.status || "unknown";
      if (lastGpsStatus.current && lastGpsStatus.current !== gpsStatus) {
        addEvent("gps", `GPS status changed: ${lastGpsStatus.current} → ${gpsStatus}`);
      }
      lastGpsStatus.current = gpsStatus;
      setTelemetry(doc);
      setLastSeenAt(Date.now());
      if (doc.gps?.latitude != null && doc.gps?.longitude != null) {
        setLocationHistory((points) => [
          ...points,
          {
            latitude: Number(doc.gps.latitude),
            longitude: Number(doc.gps.longitude),
            status: gpsStatus,
            speed: Number(doc.speed || 0),
            course: Number(doc.gps.course || 0),
            timestamp: doc.timestamp || new Date().toISOString(),
          },
        ].slice(-80));
      }
      setChartPoints((points) => pushChartPoint(points, doc));
    },
    [addEvent]
  );

  const startAlertFlow = useCallback(
    (alert, telemetrySnapshot) => {
      if (!alert) return;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setActiveAlert({ alert, telemetry: telemetrySnapshot || null });
      setAlertOutcome(null);
      setSosToastVisible(false);
      setAccidentState("COUNTDOWN");
      setCountdown(SOS_COUNTDOWN_SECONDS);
      addEvent("accident", `Accident alert received (${alert.severity || "high"})`);

      countdownRef.current = setInterval(() => {
        setCountdown((value) => {
          if (value === null) return null;
          if (value <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            setAlertOutcome("sos");
            setAccidentState("SOS_TRIGGERED");
            setActiveAlert(null);
            addEvent("sos", "SOS TRIGGERED — emergency dispatch sequence started");
            api.postEmergencySOS({ ...alert, telemetry: telemetrySnapshot || null, deviceId: alert.deviceId }).then((result) => {
              if (result?.data) setEmergencyEvents((previous) => [result.data, ...previous].slice(0, 50));
            }).catch((error) => addEvent("system", `SOS persistence error: ${error.message}`));
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    },
    [addEvent]
  );

  const cancelAlert = useCallback(() => {
    const alert = activeAlert?.alert;
    const telemetrySnapshot = activeAlert?.telemetry;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setActiveAlert(null);
    setCountdown(null);
    setAlertOutcome("cancelled");
    setSosToastVisible(false);
    setAccidentState("CANCELLED");
    addEvent("sos", "False Alarm / Alert Cancelled");
    if (alert) {
      api.cancelEmergency({ ...alert, telemetry: telemetrySnapshot, deviceId: alert.deviceId }).then((result) => {
        if (result?.data) setEmergencyEvents((previous) => [result.data, ...previous].slice(0, 50));
      }).catch((error) => addEvent("system", `Cancellation persistence error: ${error.message}`));
    }
  }, [activeAlert, addEvent]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const health = await api.getHealth();
        if (cancelled) return;
        setBackendOnline(Boolean(health?.ok) || health?.database === "connected" || Boolean(health));
        setBackendError(health?.database === "disconnected" ? "API up, Neon disconnected" : "");
        if (health && health.ok === false && health.database === "disconnected") {
          setBackendOnline(true);
        }
      } catch (error) {
        if (cancelled) return;
        const databaseOffline = error.status === 503 && (error.body?.database === "disconnected" || error.body?.error === "Database is not connected");
        setBackendOnline(databaseOffline);
        setBackendError(databaseOffline ? "Neon disconnected; using API memory buffer" : error.message || "Backend unavailable");
      }

      try {
        const [latest, history, accidentList, emergencyList] = await Promise.all([
          api.getLatestTelemetry(DEVICE_ID),
          api.getTelemetry(DEVICE_ID, CHART_POINTS),
          api.getAccidents(DEVICE_ID, 30),
          api.getEmergencyEvents(DEVICE_ID, 30),
        ]);
        if (cancelled) return;
        if (latest?.data) ingestTelemetry(latest.data);
        if (Array.isArray(history?.data)) {
          const chronological = [...history.data].reverse();
          setLocationHistory(chronological.filter((item) => item.gps?.latitude != null && item.gps?.longitude != null).map((item) => ({
            latitude: Number(item.gps.latitude),
            longitude: Number(item.gps.longitude),
            status: item.gps.status || "unknown",
            speed: Number(item.speed || 0),
            course: Number(item.gps.course || 0),
            timestamp: item.timestamp || new Date().toISOString(),
          })).slice(-80));
          setChartPoints(chronological.reduce((acc, item) => pushChartPoint(acc, item), []));
        }
        if (Array.isArray(accidentList?.data)) {
          setAccidents(accidentList.data);
        }
        if (Array.isArray(emergencyList?.data)) setEmergencyEvents(emergencyList.data);
      } catch {
        // Health already captured backend/DB issues.
      }
    }

    refresh();
    const poll = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [ingestTelemetry]);

  const refreshSimulator = useCallback(async () => {
    try {
      const result = await api.getSimulatorStatus();
      setSimulator(result?.data || null);
      setSimulatorError("");
    } catch (error) {
      setSimulator(null);
      setSimulatorError(error.message || "Simulator unavailable");
    }
  }, []);

  useEffect(() => {
    refreshSimulator();
    const poll = setInterval(refreshSimulator, 2000);
    return () => clearInterval(poll);
  }, [refreshSimulator]);

  const controlSimulator = useCallback(async (command) => {
    try {
      const result = await api.controlSimulator(command);
      setSimulator((current) => ({ ...current, ...(result?.data || {}) }));
      setSimulatorError("");
      return result;
    } catch (error) {
      setSimulatorError(error.message || "Simulator control failed");
      throw error;
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setSocketConnected(true);
      addEvent("system", "Socket.IO connected");
      socket.emit("device:join", DEVICE_ID);
    };
    const onDisconnect = () => {
      setSocketConnected(false);
      addEvent("system", "Socket.IO disconnected");
    };
    const onTelemetry = (doc) => ingestTelemetry(doc);
    const onSuspected = (payload) => {
      setAccidentState("SUSPECTED");
      addEvent("accident", `Suspected impact (${payload.triggeredSignals?.join(", ") || "sensor signal"})`);
    };
    const onConfirmed = (payload) => {
      setAccidentState("CONFIRMED");
      addEvent("accident", `Accident confirmed (${payload.confidence || 0}% confidence)`);
    };
    const onCountdown = () => setAccidentState("COUNTDOWN");
    const onCancelled = (event) => {
      setAccidentState("CANCELLED");
      setAlertOutcome("cancelled");
      setSosToastVisible(false);
      setEmergencyEvents((previous) => [event, ...previous].slice(0, 50));
    };
    const onEmergency = (event) => {
      setAccidentState("SOS_TRIGGERED");
      setAlertOutcome("sos");
      setSosToastVisible(true);
      setActiveAlert(null);
      setEmergencyEvents((previous) => [event, ...previous].slice(0, 50));
      addEvent("sos", event.type === "MANUAL_SOS" ? "Manual SOS triggered" : "SOS TRIGGERED — A7670C interface ready");
    };
    const onAccident = (payload) => {
      const alert = payload?.alert || payload;
      const linkedTelemetry = payload?.telemetry || null;
      setAccidents((prev) => [alert, ...prev].slice(0, 50));
      startAlertFlow(alert, linkedTelemetry);
    };
    const onBlockchainStatus = (payload) => {
      setAccidents((previous) => previous.map((accident) => (
        String(accident._id) === String(payload.accidentId)
          ? { ...accident, blockchainStatus: payload.status, evidenceHash: payload.evidenceHash, blockchainReference: payload.blockchainReference, blockchainRecordedAt: payload.recordedAt }
          : accident
      )));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("telemetry:update", onTelemetry);
    socket.on("accident:suspected", onSuspected);
    socket.on("accident:confirmed", onConfirmed);
    socket.on("accident:countdown", onCountdown);
    socket.on("accident:cancelled", onCancelled);
    socket.on("emergency:sos", onEmergency);
    socket.on("emergency:manual", onEmergency);
    socket.on("accident:alert", onAccident);
    socket.on("accident:blockchain-status", onBlockchainStatus);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("telemetry:update", onTelemetry);
      socket.off("accident:suspected", onSuspected);
      socket.off("accident:confirmed", onConfirmed);
      socket.off("accident:countdown", onCountdown);
      socket.off("accident:cancelled", onCancelled);
      socket.off("emergency:sos", onEmergency);
      socket.off("emergency:manual", onEmergency);
      socket.off("accident:alert", onAccident);
      socket.off("accident:blockchain-status", onBlockchainStatus);
    };
  }, [addEvent, ingestTelemetry, startAlertFlow]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const simulateAccident = useCallback(async () => {
    setSimulateBusy(true);
    setSimulateError("");
    const source = telemetry || {};
    const payload = {
      deviceId: DEVICE_ID,
      timestamp: new Date().toISOString(),
      speed: Number(source.speed ?? 18),
      acceleration: source.acceleration || { x: 8.4, y: 9.1, z: 3.2 },
      gyroscope: source.gyroscope || { x: 32, y: 18, z: 11 },
      leanAngle: Number(source.leanAngle ?? 54),
      temperature: Number(source.temperature ?? 38),
      current: Number(source.current ?? 2.1),
      gps: {
        latitude: hasGpsFix(source) ? source.gps.latitude : CHENNAI_CENTER.latitude,
        longitude: hasGpsFix(source) ? source.gps.longitude : CHENNAI_CENTER.longitude,
        speed: Number(source.gps?.speed ?? source.speed ?? 18),
        course: Number(source.gps?.course ?? 0),
        status: hasGpsFix(source) ? source.gps.status : "fix",
      },
      networkStatus: source.networkStatus || "online",
      accidentStatus: "accident",
      severity: "critical",
      source: "dashboard-demo",
      message: "Dashboard SIMULATE ACCIDENT",
    };

    try {
      const result = await api.postAccident(payload);
      const alert = result?.data?.alert;
      const linked = result?.data?.telemetry;
      if (alert && !socketConnected) {
        setAccidents((prev) => [alert, ...prev].slice(0, 50));
        startAlertFlow(alert, linked);
      }
    } catch (error) {
      setSimulateError(error.message || "Accident API failed");
      addEvent("system", `Accident API error: ${error.message}`);
    } finally {
      setSimulateBusy(false);
    }
  }, [addEvent, socketConnected, startAlertFlow, telemetry]);

  const triggerSimulatorAccident = useCallback(async () => {
    setSimulateBusy(true);
    setSimulateError("");
    try {
      await controlSimulator("accident");
      addEvent("accident", "Simulator accident sequence started");
    } catch (error) {
      setSimulateError(error.message || "Simulator unavailable");
    } finally {
      setSimulateBusy(false);
    }
  }, [addEvent, controlSimulator]);

  const triggerManualSOS = useCallback(async () => {
    setManualSosBusy(true);
    try {
      const result = await api.postManualSOS({ deviceId: DEVICE_ID });
      if (result?.data) setEmergencyEvents((previous) => [result.data, ...previous].slice(0, 50));
      return result;
    } finally {
      setManualSosBusy(false);
    }
  }, []);

  const telemetryFresh = lastSeenAt && Date.now() - lastSeenAt < TELEMETRY_STALE_MS;
  const gpsOk = hasGpsFix(telemetry);

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

  const emergencyValue = useMemo(
    () => ({
      activeAlert,
      countdown,
      cancelAlert,
      alertOutcome,
      accidentState,
      sosToastVisible,
      dismissSosToast: () => setSosToastVisible(false),
    }),
    [activeAlert, countdown, cancelAlert, alertOutcome, accidentState, sosToastVisible]
  );

  return (
    <DashboardContext.Provider value={value}>
      <EmergencyContext.Provider value={emergencyValue}>{children}</EmergencyContext.Provider>
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return context;
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error("useEmergency must be used inside DashboardProvider");
  }
  return context;
}
