import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "../../context/DashboardContext.jsx";

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
};

export default function LiveCharts() {
  const { chartPoints, telemetryFresh } = useDashboard();
  const data = chartPoints.length ? chartPoints : [{ time: "—", speed: 0, accelX: 0, accelY: 0, accelZ: 0, gyroX: 0, gyroY: 0, gyroZ: 0, temperature: 0, current: 0 }];

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Speed" hint={telemetryFresh ? "Socket.IO" : "Waiting for samples"}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="speed" stroke="#22d3ee" dot={false} strokeWidth={2} />
        </LineChart>
      </ChartCard>
      <ChartCard title="Acceleration">
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="accelX" stroke="#38bdf8" dot={false} />
          <Line type="monotone" dataKey="accelY" stroke="#a78bfa" dot={false} />
          <Line type="monotone" dataKey="accelZ" stroke="#34d399" dot={false} />
        </LineChart>
      </ChartCard>
      <ChartCard title="Gyroscope">
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="gyroX" stroke="#f59e0b" dot={false} />
          <Line type="monotone" dataKey="gyroY" stroke="#f97316" dot={false} />
          <Line type="monotone" dataKey="gyroZ" stroke="#ef4444" dot={false} />
        </LineChart>
      </ChartCard>
      <div className="grid gap-4">
        <ChartCard title="Temperature" compact>
          <LineChart data={data}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="temperature" stroke="#fb7185" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Current" compact>
          <LineChart data={data}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="time" hide />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="current" stroke="#2dd4bf" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, hint, children, compact }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </div>
      <div className={compact ? "h-36" : "h-56"}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </article>
  );
}
