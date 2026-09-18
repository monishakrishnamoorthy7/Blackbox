import { useDashboard } from "../../context/DashboardContext.jsx";
import { formatTime } from "../../utils/format.js";

export default function RecentEvents() {
  const { events, telemetry, accidents } = useDashboard();
  const rows = events.length
    ? events
    : [
        {
          id: "placeholder",
          type: "system",
          message: telemetry ? "Awaiting additional events" : "No telemetry, accidents, or GPS changes yet",
          at: accidents[0]?.timestamp || telemetry?.timestamp,
        },
      ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="mb-4 text-sm font-semibold text-white">Recent Events</h2>
      <ul className="max-h-80 space-y-2 overflow-auto pr-1">
        {rows.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/80 bg-[#0b1220] px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">{event.type}</p>
              <p className="text-sm text-slate-200">{event.message}</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatTime(event.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
