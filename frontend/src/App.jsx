import { Activity, CircleAlert, Clock3, RadioTower } from "lucide-react";
import { useState } from "react";
import Sidebar from "./components/layout/Sidebar.jsx";
import Header from "./components/layout/Header.jsx";
import AccidentAlert from "./components/alerts/AccidentAlert.jsx";
import { useDashboard } from "./context/DashboardContext.jsx";
import { signIn } from "./services/auth.js";
import {
  AlertsPage,
  DashboardPage,
  HistoryPage,
  ReportsPage,
  SettingsPage,
  TrackingPage,
  VehiclesPage,
} from "./components/pages/OperationsPages.jsx";

const pageMeta = {
  dashboard: ["Operations overview", "Current status across the monitored bike and response system."],
  tracking: ["Live tracking", "Follow location, movement, GPS state, and route continuity."],
  alerts: ["Alert center", "Respond to active emergencies and review the response log."],
  history: ["Accident history", "Investigate recorded incidents and their evidence."],
  vehicles: ["Vehicles", "Monitor registered bikes, devices, and sensor health."],
  reports: ["Reports", "Analyze incident patterns and generate downloadable reports."],
  settings: ["Settings", "Configure detection, device, emergency, GPS, and network behavior."],
};

const pages = {
  dashboard: DashboardPage,
  tracking: TrackingPage,
  alerts: AlertsPage,
  history: HistoryPage,
  vehicles: VehiclesPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { view, backendOnline, backendError, socketConnected, telemetryFresh } = useDashboard();
  const [title, subtitle] = pageMeta[view] || pageMeta.dashboard;
  const Page = pages[view] || DashboardPage;

  function handleGoogleContinue() {
    setSelectedProvider("google");
    setShowCredentials(true);
    setAuthError("");
  }

  function handleEmailOption() {
    setSelectedProvider("email");
    setShowCredentials(true);
    setAuthError("");
  }

  function handleEmailSubmit(event) {
    event.preventDefault();

    const result = signIn({
      email,
      password,
      provider: selectedProvider,
    });

    if (!result.ok) {
      setAuthError(result.message);
      return;
    }

    setAuthError("");
    setIsAuthenticated(true);
  }

  if (!isAuthenticated) {
    return (
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-branding">
            <div className="login-brand-mark">BB</div>
            <div>
              <p className="section-kicker">Bike Black Box</p>
              <h1>Operations access</h1>
            </div>
          </div>

          <div className="login-card">
            <p className="login-kicker">Secure sign in</p>

            <h2>
              {showCredentials
                ? selectedProvider === "google"
                  ? "Continue with Google"
                  : "Welcome back"
                : "Continue with Google"}
            </h2>

            <button
              type="button"
              className={`login-button google-button ${
                selectedProvider === "google" && showCredentials
                  ? "is-selected"
                  : ""
              }`}
              onClick={handleGoogleContinue}
            >
              <span className="login-button-icon">G</span>
              Continue with Google
            </button>

            {showCredentials ? (
              <>
                <div className="divider">
                  <span>or</span>
                </div>

                <form onSubmit={handleEmailSubmit} className="login-form">
                  <label>
                    <span>
                      {selectedProvider === "google"
                        ? "Google email"
                        : "Email"}
                    </span>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={
                        selectedProvider === "google"
                          ? "yourname@gmail.com"
                          : "you@blackbox.com"
                      }
                    />
                  </label>

                  <label>
                    <span>
                      {selectedProvider === "google"
                        ? "Google password"
                        : "Password"}
                    </span>

                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        selectedProvider === "google"
                          ? "Enter your Google password"
                          : "Enter your password"
                      }
                    />
                  </label>

                  {authError ? (
                    <p className="login-error">{authError}</p>
                  ) : null}

                  <button
                    type="submit"
                    className="login-button primary-button"
                  >
                    {selectedProvider === "google"
                      ? "Continue with Google"
                      : "Continue with Email / Password"}
                  </button>

                  <button
                    type="button"
                    className="login-switch"
                    onClick={handleEmailOption}
                  >
                    Use Email / Password instead
                  </button>
                </form>
              </>
            ) : (
              <button
                type="button"
                className="login-switch login-switch-top"
                onClick={handleEmailOption}
              >
                Use Email / Password instead
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#071018] text-slate-100">
      <div className="flex h-screen min-h-0">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden lg:ml-64">
          <Header onMenu={() => setSidebarOpen(true)} />

          <main className="mx-auto max-w-[1700px] space-y-5 p-4 sm:p-6 xl:p-8">
            <section className="flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-5 md:flex-row md:items-end">
              <div>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                  Control room / {view}
                </p>

                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {title}
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  {subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <SignalPill
                  icon={RadioTower}
                  label={backendOnline ? "API connected" : "API unavailable"}
                  good={backendOnline}
                />

                <SignalPill
                  icon={Activity}
                  label={
                    socketConnected
                      ? "Live stream"
                      : "Stream disconnected"
                  }
                  good={socketConnected}
                />

                <SignalPill
                  icon={Clock3}
                  label={
                    telemetryFresh
                      ? "Telemetry current"
                      : "Telemetry stale"
                  }
                  good={telemetryFresh}
                />
              </div>
            </section>

            {!backendOnline ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {backendError ||
                    "Backend unavailable. Start the API to receive live telemetry."}
                </span>
              </div>
            ) : null}

            <Page />
          </main>
        </div>
      </div>

      <AccidentAlert />
    </div>
  );
}

function SignalPill({ icon: Icon, label, good }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium ${
        good
          ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
          : "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}