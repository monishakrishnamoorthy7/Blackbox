import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Gauge,
  LocateFixed,
  MapPin,
  Radio,
  Search,
  Settings2,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Thermometer,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DemoControl from "../dashboard/DemoControl.jsx";
import LiveMap from "../map/LiveMap.jsx";
import SensorStatus from "../dashboard/SensorStatus.jsx";
import RecentEvents from "../dashboard/RecentEvents.jsx";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { api } from "../../services/api.js";
import { DEVICE_ID } from "../../config.js";
import { formatCoord, formatTime, impactMagnitude } from "../../utils/format.js";

const chartTooltip = { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 };
const severityColors = { critical: "#f87171", high: "#fb923c", medium: "#facc15", low: "#34d399" };

export function DashboardPage() {
  const { telemetry, telemetryFresh, gpsOk, emergencyEvents, events, backendOnline, socketConnected } = useDashboard();
  const latestEmergency = emergencyEvents[0];
  const impact = impactMagnitude(telemetry?.acceleration);
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={Gauge} label="Current speed" value={value(telemetry?.speed, "km/h")} />
      <Metric icon={Zap} label="Acceleration / impact" value={value(impact, "m/s²", 2)} alert={impact >= 15} />
      <Metric icon={Activity} label="Lean angle" value={value(telemetry?.leanAngle, "°", 1)} alert={Math.abs(telemetry?.leanAngle || 0) >= 35} />
      <Metric icon={Thermometer} label="Temperature" value={value(telemetry?.temperature, "°C")} />
      <Metric icon={BatteryCharging} label="Current" value={value(telemetry?.current, "A", 2)} />
      <Metric icon={ShieldAlert} label="Emergency state" value={latestEmergency?.state || "STANDBY"} alert={latestEmergency?.state === "SOS_TRIGGERED"} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
      <LiveMap className="h-[320px] sm:h-[380px]" />
      <div className="grid gap-5">
        <div className="panel p-5"><p className="section-kicker">System posture</p><h2 className="mt-1 text-lg font-semibold text-white">Current control-room status</h2><div className="mt-4 grid grid-cols-2 gap-3"><Status label="API" value={backendOnline ? "Online" : "Unavailable"} good={backendOnline} /><Status label="Socket" value={socketConnected ? "Connected" : "Waiting"} good={socketConnected} /><Status label="GPS" value={telemetry?.gps?.status?.toUpperCase() || "No data"} good={gpsOk} /><Status label="Network" value={telemetry?.networkStatus?.toUpperCase() || "Unknown"} good={telemetryFresh} /></div></div>
        <div className="panel p-5"><p className="section-kicker">Latest response</p><h2 className="mt-1 text-lg font-semibold text-white">Emergency status</h2><p className="mt-4 text-sm text-slate-300">{latestEmergency ? `${latestEmergency.type} · ${latestEmergency.state}` : "No active emergency response"}</p><p className="mt-1 text-xs text-slate-500">{latestEmergency ? formatTime(latestEmergency.timestamp) : "Monitoring BBX-SIM-001"}</p></div>
      </div>
    </section>
    <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="panel p-5"><SectionTitle kicker="Sensor snapshot" title="System health summary" /><SensorStatus /></div><div className="panel p-5"><SectionTitle kicker="Live feed" title="Recent events" /><div className="mt-3"><RecentEvents /></div></div></section>
  </div>;
}

export function TrackingPage() {
  const { telemetry, locationHistory, gpsOk, lastSeenAt, telemetryFresh } = useDashboard();
  const current = telemetry?.gps || {};
  return <div className="space-y-5">
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <LiveMap className="h-[560px] sm:h-[650px]" />
      <div className="space-y-5">
        <div className="panel p-5"><SectionTitle kicker="Position lock" title="Current location" /><div className="mt-5 space-y-4"><LocationRow icon={MapPin} label="Latitude" value={formatCoord(current.latitude)} /><LocationRow icon={MapPin} label="Longitude" value={formatCoord(current.longitude)} /><LocationRow icon={Gauge} label="Speed" value={value(telemetry?.speed, "km/h")} /><LocationRow icon={LocateFixed} label="Course" value={value(current.course, "°", 0)} /><LocationRow icon={Radio} label="GPS state" value={current.status?.toUpperCase() || "NO DATA"} /><LocationRow icon={Wifi} label="Network" value={telemetry?.networkStatus?.toUpperCase() || "UNKNOWN"} /></div></div>
        <div className="panel p-5"><SectionTitle kicker="Last contact" title="Tracking health" /><p className="mt-4 text-2xl font-semibold text-white">{lastSeenAt ? formatTime(lastSeenAt) : "No signal"}</p><p className={`mt-2 text-sm ${telemetryFresh ? "text-emerald-300" : "text-amber-300"}`}>{telemetryFresh ? "Telemetry is current" : "Telemetry is stale"}</p></div>
      </div>
    </section>
    <section className="panel p-5"><SectionTitle kicker="GPS timeline" title="Location state transitions" /><div className="mt-4 max-h-64 overflow-auto"><table className="data-table"><thead><tr><th>Time</th><th>GPS state</th><th>Coordinates</th><th>Speed</th><th>Course</th></tr></thead><tbody>{locationHistory.length ? [...locationHistory].reverse().map((point, index) => <tr key={`${point.timestamp}-${index}`}><td>{formatTime(point.timestamp)}</td><td><StateBadge state={point.status} /></td><td>{formatCoord(point.latitude)}, {formatCoord(point.longitude)}</td><td>{value(point.speed, "km/h")}</td><td>{value(point.course, "°", 0)}</td></tr>) : <tr><td colSpan="5" className="empty-cell">No GPS history received yet.</td></tr>}</tbody></table></div></section>
  </div>;
}

export function AlertsPage() {
  const { activeAlert, countdown, emergencyEvents, accidentState, triggerManualSOS, manualSosBusy, cancelAlert } = useDashboard();
  const [manualConfirm, setManualConfirm] = useState(false);
  const active = activeAlert?.alert;
  const latestEmergency = emergencyEvents[0];
  const sosActive = !active && latestEmergency?.state === "SOS_TRIGGERED";
  return <div className="space-y-5">
    <section className={`panel p-6 ${active || sosActive ? "border-red-500/50 bg-red-950/20" : ""}`}><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="section-kicker text-red-300">Response command</p><h2 className="mt-1 text-2xl font-semibold text-white">{active ? "Accident response active" : sosActive ? "SOS TRIGGERED" : "No active emergency"}</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">{active ? "Review the evidence below and cancel the countdown if this is a false alarm." : sosActive ? "Emergency dispatch sequence has been triggered for the monitored device." : "Active alerts and emergency dispatch status appear here in real time."}</p></div>{active ? <div className="text-center"><p className="text-[10px] uppercase tracking-[0.2em] text-red-300">SOS countdown</p><p className="mt-1 text-5xl font-black text-red-300">{countdown ?? 0}</p></div> : sosActive ? <Siren className="h-12 w-12 text-red-400" /> : <CheckCircle2 className="h-12 w-12 text-emerald-400" />}</div>{active ? <div className="mt-5 grid gap-3 sm:grid-cols-3"><Detail label="Severity" value={active.severity} /><Detail label="Confidence" value={`${active.confidence || 0}%`} /><Detail label="Impact" value={value(active.impact, "m/s²", 2)} /><Detail label="Speed before / after" value={`${active.speedBeforeImpact || active.speedBefore || 0} / ${active.speedAfterImpact || active.speedAfter || 0} km/h`} /><Detail label="Location" value={active.latitude != null ? `${formatCoord(active.latitude)}, ${formatCoord(active.longitude)}` : "GPS unavailable"} /><Detail label="Network" value={active.networkStatus || "unknown"} /><Detail label="SOS status" value={active.sosStatus || "PENDING"} /></div> : sosActive ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Severity" value={latestEmergency.severity || "high"} /><Detail label="Location" value={latestEmergency.latitude != null ? `${formatCoord(latestEmergency.latitude)}, ${formatCoord(latestEmergency.longitude)}` : "GPS unavailable"} /><Detail label="Timestamp" value={formatTime(latestEmergency.timestamp)} /><Detail label="SOS status" value={latestEmergency.state} /></div> : null}{active ? <button type="button" onClick={cancelAlert} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"><XCircle className="h-4 w-4" />Cancel alert</button> : null}</section>
    <section className="grid items-stretch gap-5 lg:grid-cols-2"><div className="panel flex flex-col p-5"><SectionTitle kicker="Operator action" title="Manual emergency signal" /><p className="mt-2 max-w-md text-sm text-slate-400">Send a confirmed manual SOS for the monitored device when immediate assistance is required.</p><div className="mt-auto flex flex-wrap gap-3 pt-6"><button type="button" disabled={manualSosBusy} onClick={async () => { if (!manualConfirm) return setManualConfirm(true); try { await triggerManualSOS(); setManualConfirm(false); } catch { /* Context reports the request failure. */ } }} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${manualConfirm ? "border border-red-400/40 bg-red-600 hover:bg-red-500" : "bg-red-600 hover:bg-red-500"}`}><Siren className="h-4 w-4" />{manualSosBusy ? "Sending..." : manualConfirm ? "Confirm SOS" : "Send manual SOS"}</button>{manualConfirm ? <button type="button" onClick={() => setManualConfirm(false)} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-white">Keep monitoring</button> : null}</div></div><DemoControl /></section>
    <section className="panel p-5"><SectionTitle kicker="Response log" title="Current and resolved alerts" /><div className="mt-4 space-y-2">{emergencyEvents.length ? emergencyEvents.map((event, index) => <div key={`${event._id || "event"}-${event.timestamp || "unknown"}-${index}`} className="flex flex-col justify-between gap-2 rounded-lg border border-slate-800 bg-[#0a141d] p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">{event.type} <span className="text-slate-500">·</span> {event.state}</p><p className="text-xs text-slate-500">{event.deviceId} · {formatTime(event.timestamp)}</p></div><StateBadge state={event.state} /></div>) : <Empty text="No emergency events recorded." />}</div></section>
  </div>;
}

export function HistoryPage() {
  const { accidents, emergencyEvents } = useDashboard();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [selected, setSelected] = useState(null);
  const [verification, setVerification] = useState(null);
  const filtered = accidents.filter((accident) => (!query || `${accident._id} ${accident.deviceId}`.toLowerCase().includes(query.toLowerCase())) && (severity === "all" || accident.severity === severity));
  const vibrationDetected = filtered.filter((accident) => accident.vibration === true).length;
  const vibrationClear = filtered.filter((accident) => accident.vibration === false).length;
  const vibrationUnavailable = filtered.filter((accident) => accident.vibration === undefined).length;
  return <div className="space-y-5">
    <section className="panel p-5"><SectionTitle kicker="Supporting sensor" title="SW-420 vibration coverage" /><div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat label="Detected" value={vibrationDetected} /><Stat label="No vibration" value={vibrationClear} /><Stat label="Unavailable" value={vibrationUnavailable} /></div><div className="mt-4 max-h-40 overflow-auto"><div className="grid gap-2">{filtered.map((accident, index) => <div key={`vibration-${accident._id || index}`} className="flex items-center justify-between border-b border-slate-800 pb-2 text-sm"><span className="font-mono text-xs text-slate-500">{String(accident._id || "—").slice(-12)}</span><span className={accident.vibration === true ? "font-semibold text-amber-300" : "text-slate-400"}>{accident.vibration === undefined ? "N/A" : accident.vibration ? "Detected" : "Not detected"}</span></div>)}</div></div></section>
    <section className="panel p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><SectionTitle kicker="Investigation archive" title="Accident records" /><p className="mt-1 text-sm text-slate-400">Historical incidents only. Use Reports for analysis and downloads.</p></div><div className="flex flex-wrap gap-2"><label className="input-wrap"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID or device" /></label><label className="input-wrap"><Filter className="h-4 w-4" /><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severity</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div></div><div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Accident ID</th><th>Date / time</th><th>Severity</th><th>Confidence</th><th>Impact</th><th>Speed before</th><th>Speed after</th><th>SOS</th><th>Action</th></tr></thead><tbody>{filtered.length ? filtered.map((accident, index) => { const emergency = emergencyEvents.find((event) => event.accidentId === accident._id); return <tr key={accident._id || index}><td className="font-mono text-xs">{String(accident._id || "—").slice(-12)}</td><td>{formatTime(accident.timestamp)}</td><td><Severity severity={accident.severity} /></td><td>{Number(accident.confidence || 0)}%</td><td>{value(accident.impact, "m/s²", 2)}</td><td>{value(accident.speedBeforeImpact || accident.speedBefore || accident.speed, "km/h", 1)}</td><td>{value(accident.speedAfterImpact || accident.speedAfter, "km/h", 1)}</td><td>{emergency?.state || accident.sosStatus || "PENDING"}</td><td><button type="button" className="text-cyan-300 hover:text-white" onClick={() => setSelected(accident)}>View details</button></td></tr>; }) : <tr><td colSpan="9" className="empty-cell">No accident records match these filters.</td></tr>}</tbody></table></div></section>
    {selected ? <section className="panel border-cyan-400/30 p-5"><div className="flex items-start justify-between"><SectionTitle kicker="Evidence review" title="Accident detail" /><button type="button" onClick={() => { setSelected(null); setVerification(null); }} className="icon-button" aria-label="Close details"><XCircle className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="ID" value={selected._id || "—"} /><Detail label="Device" value={selected.deviceId} /><Detail label="GPS" value={selected.latitude != null ? `${formatCoord(selected.latitude)}, ${formatCoord(selected.longitude)}` : "Unavailable"} /><Detail label="GPS status" value={selected.gpsStatus || "nofix"} /><Detail label="Acceleration" value={JSON.stringify(selected.acceleration || {})} /><Detail label="Gyroscope" value={JSON.stringify(selected.gyroscope || {})} /><Detail label="Triggered signals" value={selected.triggeredSignals?.join(", ") || "None recorded"} /><Detail label="Message" value={selected.message || "Accident alert"} /></div><div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">Tamper-evident evidence</p><p className="mt-1 text-sm text-slate-300">Accident evidence is cryptographically committed and can be verified for modification.</p></div><EvidenceBadge status={verification?.status || selected.blockchainStatus || "PENDING"} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Evidence ID" value={selected.evidenceId || "Pending"} /><Detail label="SHA-256" value={selected.evidenceHash || "Pending"} /><Detail label="Ledger reference" value={verification?.blockchainReference || selected.blockchainReference || "Pending"} /><Detail label="Recorded" value={formatTime(verification?.blockchainRecordedAt || selected.blockchainRecordedAt)} /></div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={!selected.evidenceId || verification?.status === "VERIFYING"} onClick={async () => { setVerification({ status: "VERIFYING" }); try { const result = await api.verifyAccidentBlockchain(selected._id); setVerification(result.data); setSelected((current) => ({ ...current, blockchainStatus: result.data.status, blockchainReference: result.data.blockchainReference })); } catch (error) { setVerification({ status: "UNAVAILABLE", error: error.message }); } }} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{verification?.status === "VERIFYING" ? "Verifying..." : "Verify Evidence"}</button>{verification?.error ? <span className="text-xs text-amber-300">{verification.error}</span> : null}</div></div></section> : null}
  </div>;
}

export function VehiclesPage() {
  const { telemetry, telemetryFresh, gpsOk, simulator, socketConnected, deviceId } = useDashboard();
  return <div className="space-y-5"><section className="panel p-5"><div className="flex items-center justify-between"><SectionTitle kicker="Device registry" title="Monitored vehicles" /><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400 hover:text-cyan-300"><Smartphone className="h-4 w-4" />Open vehicle details</button></div><div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Vehicle ID</th><th>Device ID</th><th>Status</th><th>Last seen</th><th>GPS</th><th>Network</th><th>Speed</th><th>Location</th></tr></thead><tbody><tr><td>BIKE-001</td><td className="font-mono text-xs">{deviceId}</td><td><StateBadge state={telemetryFresh ? "ONLINE" : "OFFLINE"} /></td><td>{telemetry?.timestamp ? formatTime(telemetry.timestamp) : "No data"}</td><td>{telemetry?.gps?.status?.toUpperCase() || "NO DATA"}</td><td>{telemetry?.networkStatus?.toUpperCase() || "UNKNOWN"}</td><td>{value(telemetry?.speed, "km/h")}</td><td>{gpsOk ? `${formatCoord(telemetry.gps.latitude)}, ${formatCoord(telemetry.gps.longitude)}` : "Unavailable"}</td></tr></tbody></table></div></section><section className="grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="panel p-5"><SectionTitle kicker="Selected vehicle" title="BBX-SIM-001 health" /><div className="mt-4 grid grid-cols-2 gap-3"><Status label="Simulator" value={simulator?.running ? "Running" : "Stopped"} good={Boolean(simulator?.running)} /><Status label="Socket" value={socketConnected ? "Connected" : "Disconnected"} good={socketConnected} /><Status label="GPS" value={gpsOk ? "Fix" : "No fix"} good={gpsOk} /><Status label="Last seen" value={telemetryFresh ? "Current" : "Stale"} good={telemetryFresh} /></div></div><div className="panel p-5"><SectionTitle kicker="Sensor inventory" title="Installed sensor health" /><div className="mt-3"><SensorStatus /></div></div></section></div>;
}

export function ReportsPage() {
  const { accidents, deviceId } = useDashboard();
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", status: "", severity: "", gpsStatus: "", deviceId: "" });
  const [reportAccidents, setReportAccidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const query = Object.fromEntries(Object.entries(filters).filter(([, item]) => item));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getReportAccidents({ ...query, limit: 5000 }).then((result) => {
      if (!cancelled) setReportAccidents(Array.isArray(result?.data) ? result.data : []);
    }).catch(() => {
      if (!cancelled) setReportAccidents([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filters.dateFrom, filters.dateTo, filters.status, filters.severity, filters.gpsStatus, filters.deviceId]);

  useEffect(() => {
    if (!accidents.length) return;
    setReportAccidents((current) => {
      const byId = new Map(current.map((item) => [String(item._id), item]));
      accidents.filter((item) => matchesReportFilters(item, filters)).forEach((item) => byId.set(String(item._id), item));
      return [...byId.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
  }, [accidents]);

  const stats = useMemo(() => summarizeRows(reportAccidents), [reportAccidents]);
  const charts = useMemo(() => ({
    timeline: groupByDate(reportAccidents),
    state: groupBy(reportAccidents, (item) => item.state === "CANCELLED" ? "Cancelled" : "Confirmed"),
    severity: groupBy(reportAccidents, (item) => item.severity || "unknown"),
    gps: groupBy(reportAccidents, (item) => String(item.gpsStatus || "unknown").toUpperCase()),
    sos: groupBy(reportAccidents, (item) => item.sosStatus || "PENDING"),
  }), [reportAccidents]);
  const rows = reportAccidents.map(toReportRow);
  const updateFilter = (key, next) => setFilters((current) => ({ ...current, [key]: next }));
  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", status: "", severity: "", gpsStatus: "", deviceId: "" });

  return <div className="space-y-5">
    <section className="panel overflow-hidden border-cyan-400/20 p-6"><div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"><div><p className="section-kicker text-cyan-300">Executive incident brief</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Accident intelligence report</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A structured view of detected incidents, response outcomes, and tamper-evident evidence for the monitored fleet.</p><p className="mt-4 text-xs text-slate-500">Generated {new Date().toLocaleString()} <span className="mx-2 text-slate-700">|</span> Source device {deviceId}</p></div><div className="flex flex-wrap gap-2"><ReportButton icon={Download} label="Export CSV" onClick={() => downloadCsv("bike-black-box-report.csv", rows.map(({ source, ...row }) => row))} /><ReportButton icon={FileText} label="Export PDF" onClick={() => downloadPdfReport(rows, stats, filters, charts)} /></div></div><div className="mt-6 border-t border-slate-800/80 pt-5"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-200">Report scope</p><p className="mt-1 text-xs text-slate-500">Refine the incident set used in the analysis below.</p></div><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300"><Filter className="h-3.5 w-3.5" />Reset filters</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><FilterField label="From" type="date" value={filters.dateFrom} onChange={(next) => updateFilter("dateFrom", next)} /><FilterField label="To" type="date" value={filters.dateTo} onChange={(next) => updateFilter("dateTo", next)} /><FilterField label="Status" value={filters.status} options={[["", "All statuses"], ["CONFIRMED", "Confirmed"], ["CANCELLED", "Cancelled"]]} onChange={(next) => updateFilter("status", next)} /><FilterField label="Severity" value={filters.severity} options={[["", "All severity"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]} onChange={(next) => updateFilter("severity", next)} /><FilterField label="GPS status" value={filters.gpsStatus} options={[["", "All GPS states"], ["fix", "Fix"], ["estimated", "Estimated"], ["nofix", "No fix"]]} onChange={(next) => updateFilter("gpsStatus", next)} /><FilterField label="Device ID" value={filters.deviceId} placeholder={deviceId} onChange={(next) => updateFilter("deviceId", next)} /></div></div></section>
    <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="section-kicker">Key indicators</p><h2 className="mt-1 text-lg font-semibold text-white">Incident overview</h2></div><span className="text-xs text-slate-500">{loading ? "Refreshing data..." : `${rows.length} records in scope`}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><Stat label="Total accidents" value={stats.total} /><Stat label="Confirmed" value={stats.confirmed} /><Stat label="Cancelled" value={stats.cancelled} /><Stat label="SOS triggered" value={stats.sos} /><Stat label="Average impact" value={stats.total ? `${stats.impact.toFixed(2)} m/s²` : "—"} /><Stat label="Avg speed before" value={stats.total ? `${stats.before.toFixed(1)} km/h` : "—"} /><Stat label="Avg speed after" value={stats.total ? `${stats.after.toFixed(1)} km/h` : "—"} /></div></section>
    {loading ? <Empty text="Preparing report data..." /> : !rows.length ? <Empty text="No accident data matches the current report scope." /> : <><section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><ChartPanel title="Accident count over time" hint="Filtered records"><ReportLineChart data={charts.timeline} /></ChartPanel><ChartPanel title="Confirmed vs cancelled"><ReportPie data={charts.state} colors={["#34d399", "#facc15"]} /></ChartPanel></section><section className="grid gap-5 xl:grid-cols-3"><ChartPanel title="Severity distribution"><ReportBar data={charts.severity} color="#fb923c" /></ChartPanel><ChartPanel title="GPS state distribution"><ReportBar data={charts.gps} color="#22d3ee" /></ChartPanel><ChartPanel title="SOS status distribution"><ReportBar data={charts.sos} color="#f87171" /></ChartPanel></section><section className="panel p-5"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><SectionTitle kicker="Filtered incident register" title="Accident report table" /><span className="text-xs text-slate-500">Select a row to inspect evidence</span></div><div className="mt-4 overflow-x-auto"><table className="data-table"><thead><tr><th>Accident ID</th><th>Date & time</th><th>Device ID</th><th>Severity</th><th>Impact</th><th>Vibration</th><th>Speed before</th><th>Speed after</th><th>GPS status</th><th>SOS status</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => { setSelected(row.source); setVerification(null); }} className="cursor-pointer"><td className="font-mono text-xs">{String(row.id).slice(-12)}</td><td>{formatTime(row.timestamp)}</td><td>{row.device}</td><td><Severity severity={row.severity} /></td><td>{value(row.impact, "m/s²", 2)}</td><td>{row.vibration}</td><td>{value(row.speedBefore, "km/h", 1)}</td><td>{value(row.speedAfter, "km/h", 1)}</td><td>{String(row.gpsStatus).toUpperCase()}</td><td>{row.sos}</td><td><EvidenceBadge status={row.evidenceStatus} /></td></tr>)}</tbody></table></div></section></>}
    {selected ? <ReportDetail accident={selected} verification={verification} setVerification={setVerification} onClose={() => setSelected(null)} /> : null}
  </div>;
}

export function SettingsPage() {
  const [settings, setSettings] = useState({ impact: 15, gyro: 35, speedDrop: 10, lean: 35, window: 2500, countdown: 10, notifications: true, demo: true });
  const [hardware, setHardware] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then((result) => {
      if (cancelled || !result) return;
      const { detection, hardware: hardwareConfig } = result;
      if (detection) {
        setSettings((current) => ({
          ...current,
          impact: detection.impactThreshold,
          gyro: detection.rotationThreshold,
          speedDrop: detection.speedDropThreshold,
          lean: detection.leanAngleThreshold,
          window: detection.confirmationWindowMs,
          countdown: detection.countdownSeconds,
        }));
      }
      setHardware(hardwareConfig || null);
      setSettingsError("");
    }).catch((error) => setSettingsError(error.message || "Could not load live configuration from backend"));
    return () => { cancelled = true; };
  }, []);

  const vibrationConfigured = Boolean(hardware?.vibrationSensorConfigured);

  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><section className="panel p-5"><SectionTitle kicker="Detection policy" title="Accident detection thresholds" /><p className="mt-1 text-xs text-slate-500">{settingsError ? settingsError : "Loaded from the backend's live accidentDetection config."}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{[["impact", "Impact threshold", "m/s²"], ["gyro", "Gyroscope threshold", "deg/s"], ["speedDrop", "Speed-drop threshold", "km/h"], ["lean", "Lean-angle threshold", "degrees"], ["window", "Confirmation window", "ms"], ["countdown", "Countdown duration", "seconds"]].map(([key, label, unit]) => <label key={key} className="setting-field"><span>{label}</span><div><input type="number" value={settings[key]} onChange={(event) => update(key, event.target.value)} /><em>{unit}</em></div></label>)}</div></section><div className="space-y-5"><section className="panel p-5"><SectionTitle kicker="Device profile" title="Device configuration" /><div className="mt-4 space-y-3"><Setting label="Device ID" value={DEVICE_ID} /><Setting label="Vehicle ID" value="BIKE-001" /><Setting label="Mode" value="Simulator or ESP32-S3 firmware" /><Setting label="Storage" value={hardware?.storage || "Neon + memory fallback"} /></div></section><section className="panel p-5"><SectionTitle kicker="SW-420 input" title="Vibration sensor" /><div className="mt-4 space-y-3"><Setting label="Sensor enabled" value="Yes (optional telemetry)" /><Setting label="GPIO pin" value={hardware?.vibrationSensorPin || "Not configured"} /><Setting label="Current state" value={vibrationConfigured ? "Read by ESP32 firmware" : "Simulated input"} /><p className="pt-1 text-xs leading-5 text-slate-500">{vibrationConfigured ? "Wired on the ESP32-S3; see firmware/README.md for the pin table." : "Set VIBRATION_SENSOR_PIN in backend/.env once the hardware pin is confirmed."}</p></div></section><section className="panel p-5"><SectionTitle kicker="Emergency and network" title="System configuration" /><div className="mt-4 space-y-3"><Toggle label="Notifications" checked={settings.notifications} onChange={(value) => update("notifications", value)} /><Toggle label="Demo mode" checked={settings.demo} onChange={(value) => update("demo", value)} /><Setting label="A7670C" value="Backend: simulated · Firmware: live modem" /><Setting label="GPS fallback" value="Enabled" /><Setting label="Backend" value="http://localhost:4000" /></div></section></div></div>;
}

function FilterField({ label, type = "text", value: fieldValue, options, placeholder, onChange }) {
  return <label className="flex min-w-0 flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>{label}</span>{options ? <select value={fieldValue} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-700 bg-[#0a141d] px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-slate-200 outline-none"><>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</></select> : <input type={type} value={fieldValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-700 bg-[#0a141d] px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-slate-200 outline-none placeholder:text-slate-600" />}</label>;
}

function ReportLineChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} /><Tooltip contentStyle={chartTooltip} /><Line type="monotone" dataKey="value" name="Accidents" stroke="#f87171" strokeWidth={3} dot={{ r: 3, fill: "#f87171" }} /></LineChart></ResponsiveContainer>;
}

function ReportBar({ data, color }) {
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="value" name="Accidents" fill={color} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>;
}

function ReportPie({ data, colors }) {
  return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={4}>{data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={chartTooltip} /><Legend /></PieChart></ResponsiveContainer>;
}

function ReportDetail({ accident, verification, setVerification, onClose }) {
  const status = verification?.status || accident.blockchainStatus || "PENDING";
  return <section className="panel border-cyan-400/30 p-5"><div className="flex items-start justify-between"><SectionTitle kicker="Report selection" title="Accident details" /><button type="button" onClick={onClose} className="icon-button" aria-label="Close accident details"><XCircle className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Accident ID" value={accident._id || "—"} /><Detail label="Device" value={accident.deviceId} /><Detail label="Timestamp" value={formatTime(accident.timestamp)} /><Detail label="Status" value={accident.state} /><Detail label="Severity" value={accident.severity} /><Detail label="GPS" value={accident.gpsStatus || "unknown"} /><Detail label="Impact" value={value(accident.impact, "m/s²", 2)} /><Detail label="SOS" value={accident.sosStatus || "PENDING"} /></div><div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4"><div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Tamper-evident evidence</p><p className="mt-1 text-sm text-slate-300">Verify the cryptographic commitment for this accident.</p></div><EvidenceBadge status={status} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Detail label="Evidence ID" value={accident.evidenceId || "Pending"} /><Detail label="SHA-256" value={accident.evidenceHash || "Pending"} /><Detail label="Ledger reference" value={accident.blockchainReference || "Pending"} /><Detail label="Recorded" value={formatTime(accident.blockchainRecordedAt)} /></div><button type="button" disabled={!accident.evidenceId || status === "VERIFYING"} onClick={async () => { setVerification({ status: "VERIFYING" }); try { const result = await api.verifyAccidentBlockchain(accident._id); setVerification(result.data); } catch (error) { setVerification({ status: "UNAVAILABLE", error: error.message }); } }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{status === "VERIFYING" ? "Verifying..." : "Verify Evidence"}</button>{verification?.error ? <p className="mt-2 text-xs text-amber-300">{verification.error}</p> : null}</div></section>;
}

function summarizeRows(rows) {
  const total = rows.length;
  const average = (field) => total ? rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / total : 0;
  return { total, confirmed: rows.filter((row) => row.state === "CONFIRMED").length, cancelled: rows.filter((row) => row.state === "CANCELLED").length, sos: rows.filter((row) => row.sosStatus === "SOS_TRIGGERED").length, impact: average("impact"), before: average("speedBeforeImpact"), after: average("speedAfterImpact") };
}

function matchesReportFilters(accident, filters) {
  const timestamp = new Date(accident.timestamp).getTime();
  return (!filters.deviceId || accident.deviceId === filters.deviceId) && (!filters.status || accident.state === filters.status) && (!filters.severity || accident.severity === filters.severity) && (!filters.gpsStatus || accident.gpsStatus === filters.gpsStatus) && (!filters.dateFrom || timestamp >= new Date(`${filters.dateFrom}T00:00:00`).getTime()) && (!filters.dateTo || timestamp <= new Date(`${filters.dateTo}T23:59:59.999`).getTime());
}

function toReportRow(accident) {
  return { id: accident._id, timestamp: accident.timestamp, device: accident.deviceId, severity: accident.severity, impact: accident.impact, vibration: accident.vibration === undefined ? "N/A" : accident.vibration ? "Detected" : "Not detected", speedBefore: accident.speedBeforeImpact, speedAfter: accident.speedAfterImpact, speedDrop: accident.speedDrop, gpsStatus: accident.gpsStatus, temperature: accident.temperature, current: accident.current, confidence: accident.confidence, accidentStatus: accident.accidentStatus, sos: accident.sosStatus || "PENDING", evidenceStatus: accident.blockchainStatus || "PENDING", evidenceHash: accident.evidenceHash || "", source: accident };
}

function groupBy(rows, getName) {
  const counts = rows.reduce((result, row) => { const name = getName(row); result[name] = (result[name] || 0) + 1; return result; }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function groupByDate(rows) {
  return groupBy(rows, (row) => row.timestamp ? new Date(row.timestamp).toLocaleDateString() : "Unknown");
}

function downloadPdfReport(rows, stats, filters, charts) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = 148;
  const activeFilters = Object.entries(filters).filter(([, filterValue]) => filterValue).map(([key, filterValue]) => `${key}: ${filterValue}`);
  const setText = (size, color, style = "normal") => { pdf.setFont("helvetica", style); pdf.setFontSize(size); pdf.setTextColor(...color); };
  const section = (title) => { setText(11, [8, 145, 178], "bold"); pdf.text(title, margin, y); y += 20; };
  const addPageHeader = () => {
    pdf.setFillColor(7, 16, 24); pdf.rect(0, 0, pageWidth, 92, "F");
    setText(20, [34, 211, 238], "bold"); pdf.text("BIKE BLACK BOX", margin, 38);
    setText(12, [255, 255, 255], "normal"); pdf.text("Accident incident report", margin, 60);
    setText(8, [148, 163, 184]); pdf.text(`Generated ${new Date().toLocaleString()}`, margin, 77);
  };
  const addTableHeader = () => {
    pdf.setFillColor(226, 232, 240); pdf.rect(margin, y - 13, contentWidth, 22, "F");
    setText(8, [30, 41, 59], "bold");
    [["Incident", 36], ["Date / time", 105], ["Device", 190], ["Severity", 254], ["Impact", 320], ["Vibration", 380], ["Response", 450], ["Evidence", 515]].forEach(([label, x]) => pdf.text(label, x, y));
    y += 22;
  };
  const addIncidentRow = (row, index) => {
    const values = [String(row.id).slice(-10), formatTime(row.timestamp), row.device || "-", String(row.severity || "unknown").toUpperCase(), `${Number(row.impact || 0).toFixed(2)} m/s²`, row.vibration || "N/A", row.sos || "PENDING", row.evidenceStatus || "PENDING"];
    const widths = [65, 80, 60, 60, 54, 64, 62, 44];
    const lines = values.map((value, valueIndex) => pdf.splitTextToSize(String(value), widths[valueIndex]));
    const rowHeight = Math.max(...lines.map((line) => line.length)) * 10 + 12;
    if (y + rowHeight > pageHeight - 42) { pdf.addPage(); addPageHeader(); y = 130; section("Incident register"); addTableHeader(); }
    if (index % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y - 12, contentWidth, rowHeight, "F"); }
    setText(7.5, [30, 41, 59]);
    [36, 105, 190, 254, 320, 380, 450, 515].forEach((x, valueIndex) => pdf.text(lines[valueIndex], x, y));
    y += rowHeight;
  };
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pageWidth, pageHeight, "F");
  addPageHeader();
  section("Report summary");
  setText(9, [51, 65, 85]);
  pdf.text(`Scope: ${activeFilters.length ? activeFilters.join(" | ") : "All recorded incidents"}`, margin, y); y += 24;
  [["Total incidents", stats.total], ["Confirmed", stats.confirmed], ["Cancelled", stats.cancelled], ["SOS triggered", stats.sos]].forEach(([label, valueToWrite], index) => {
    const x = margin + index * 131;
    pdf.setFillColor(241, 245, 249); pdf.roundedRect(x, y - 12, 119, 48, 5, 5, "F");
    setText(8, [100, 116, 139], "bold"); pdf.text(label, x + 10, y);
    setText(16, [15, 23, 42], "bold"); pdf.text(String(valueToWrite), x + 10, y + 24);
  });
  y += 65;
  setText(9, [51, 65, 85]); pdf.text(`Average impact ${stats.impact.toFixed(2)} m/s²    |    Average speed before ${stats.before.toFixed(1)} km/h    |    Average speed after ${stats.after.toFixed(1)} km/h`, margin, y); y += 28;
  section("Incident register");
  addTableHeader();
  rows.forEach((row, index) => addIncidentRow(row, index));
  setText(8, [100, 116, 139]); pdf.text("Evidence status is shown per incident for quick review.", margin, pageHeight - 24);
  pdf.save("bike-black-box-report.pdf");
}

function Metric({ icon: Icon, label, value: metricValue, alert }) { return <article className={`panel p-4 ${alert ? "border-red-400/40" : ""}`}><div className="flex items-center justify-between text-slate-400"><span className="text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</span><Icon className={`h-4 w-4 ${alert ? "text-red-400" : "text-cyan-400"}`} /></div><p className={`mt-3 text-2xl font-semibold ${alert ? "text-red-300" : "text-white"}`}>{metricValue}</p></article>; }
function Status({ label, value: statusValue, good }) { return <div className="rounded-lg border border-slate-800 bg-[#0a141d] p-3"><div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500"><span>{label}</span><span className={`h-2 w-2 rounded-full ${good ? "bg-emerald-400" : "bg-amber-400"}`} /></div><p className={`mt-2 text-sm font-semibold ${good ? "text-emerald-300" : "text-amber-300"}`}>{statusValue}</p></div>; }
function SectionTitle({ kicker, title }) { return <div><p className="section-kicker">{kicker}</p><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2></div>; }
function LocationRow({ icon: Icon, label, value: rowValue }) { return <div className="flex items-center justify-between border-b border-slate-800 pb-3"><span className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4 text-cyan-400" />{label}</span><strong className="font-mono text-sm text-white">{rowValue}</strong></div>; }
function Detail({ label, value: detailValue }) { return <div className="rounded-lg border border-slate-800 bg-[#0a141d] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-200">{detailValue}</p></div>; }
function StateBadge({ state }) { const normalized = String(state || "unknown").toUpperCase(); return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${normalized.includes("OFF") || normalized.includes("NOFIX") ? "bg-amber-500/15 text-amber-300" : normalized.includes("SOS") || normalized.includes("CRITICAL") ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>{normalized}</span>; }
function Severity({ severity }) { return <span className="font-semibold" style={{ color: severityColors[severity] || "#94a3b8" }}>{String(severity || "unknown").toUpperCase()}</span>; }
function EvidenceBadge({ status }) { const labels = { PENDING: "Blockchain Pending", RECORDED: "Blockchain Recorded", VERIFIED: "Verified", TAMPERED: "Tampered", UNAVAILABLE: "Blockchain Unavailable", VERIFYING: "Verifying..." }; const tone = status === "VERIFIED" || status === "RECORDED" ? "bg-emerald-500/15 text-emerald-300" : status === "TAMPERED" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{labels[status] || status}</span>; }
function Empty({ text }) { return <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">{text}</div>; }
function Stat({ label, value: statValue }) { return <div className="panel p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{statValue}</p></div>; }
function ChartPanel({ title, hint, children }) { return <section className="panel p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-white">{title}</h2><span className="text-xs text-slate-500">{hint}</span></div><div className="h-64">{children}</div></section>; }
function ReportButton({ icon: Icon, label, onClick }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300"><Icon className="h-4 w-4" />{label}</button>; }
function Setting({ label, value: settingValue }) { return <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 text-sm"><span className="text-slate-400">{label}</span><span className="text-right font-medium text-slate-200">{settingValue}</span></div>; }
function Toggle({ label, checked, onChange }) { return <label className="flex items-center justify-between border-b border-slate-800 pb-3 text-sm text-slate-300"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-400" /></label>; }
function value(number, unit = "", digits = 1) { if (number === null || number === undefined || Number.isNaN(Number(number))) return "—"; return `${Number(number).toFixed(digits)}${unit ? ` ${unit}` : ""}`; }
function downloadCsv(filename, rows) { const list = Array.isArray(rows) ? rows : []; const keys = [...new Set(list.flatMap((row) => Object.keys(row || {})))]; const csv = [keys.join(","), ...list.map((row) => keys.map((key) => JSON.stringify(row?.[key] ?? "")).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
