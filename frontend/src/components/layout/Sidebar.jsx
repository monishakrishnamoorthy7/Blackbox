import {
  Activity,
  AlertTriangle,
  Bike,
  ClipboardList,
  Gauge,
  History,
  LayoutDashboard,
  MapPin,
  Settings,
  Truck,
} from "lucide-react";
import { NAV_ITEMS } from "../../config.js";
import { useDashboard } from "../../context/DashboardContext.jsx";

const ICONS = {
  dashboard: LayoutDashboard,
  tracking: MapPin,
  alerts: AlertTriangle,
  history: History,
  vehicles: Truck,
  reports: ClipboardList,
  settings: Settings,
};

export default function Sidebar({ open, onClose }) {
  const { view, setView, telemetryFresh, socketConnected } = useDashboard();

  return (
    <>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-[#070d18] px-4 py-5 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Control room</p>
            <p className="text-sm font-semibold text-white">Black Box Ops</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.id] || Gauge;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  onClose();
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          <div className="mb-1 flex items-center gap-2 text-slate-300">
            <Activity className={`h-3.5 w-3.5 ${telemetryFresh ? "text-emerald-400" : "text-amber-400"}`} />
            Live ingest
          </div>
          {socketConnected ? "Realtime feed attached" : "Waiting for Socket.IO"}
        </div>
      </aside>
    </>
  );
}
