import {
  Activity,
  CircleAlert,
  Clock3,
  RadioTower,
} from "lucide-react";
import { useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar.jsx";
import Header from "./components/layout/Header.jsx";
import AccidentAlert from "./components/alerts/AccidentAlert.jsx";
import { useDashboard } from "./context/DashboardContext.jsx";
import {
  signIn,
  signInWithGoogle,
  subscribeToAuth,
} from "./services/auth.js";

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
  dashboard: [
    "Operations overview",
    "Current status across the monitored bike and response system.",
  ],
  tracking: [
    "Live tracking",
    "Follow location, movement, GPS state, and route continuity.",
  ],
  alerts: [
    "Alert center",
    "Respond to active emergencies and review the response log.",
  ],
  history: [
    "Accident history",
    "Investigate recorded incidents and their evidence.",
  ],
  vehicles: [
    "Vehicles",
    "Monitor registered bikes, devices, and sensor health.",
  ],
  reports: [
    "Reports",
    "Analyze incident patterns and generate downloadable reports.",
  ],
  settings: [
    "Settings",
    "Configure detection, device, emergency, GPS, and network behavior.",
  ],
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
  const [authLoading, setAuthLoading] = useState(true);

  const [showCredentials, setShowCredentials] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authError, setAuthError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    view,
    backendOnline,
    backendError,
    socketConnected,
    telemetryFresh,
  } = useDashboard();

  const [title, subtitle] =
    pageMeta[view] || pageMeta.dashboard;

  const Page = pages[view] || DashboardPage;

  /*
   * Listen for Firebase authentication state.
   *
   * This means:
   * - If the user is logged in → show dashboard
   * - If the user is not logged in → show login screen
   * - If the user refreshes the page → Firebase restores the session
   */
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setIsAuthenticated(Boolean(user));
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /*
   * Google authentication
   *
   * Clicking this button opens Google's account selector.
   */
  async function handleGoogleContinue() {
    setAuthError("");

    try {
      const result = await signInWithGoogle();

      if (!result.ok) {
        setAuthError(
          result.message || "Google sign-in failed."
        );
      }
    } catch (error) {
      console.error("Google sign-in error:", error);

      setAuthError(
        error?.message ||
          "Google sign-in failed. Please try again."
      );
    }
  }

  /*
   * Switch to email/password login.
   */
  function handleEmailOption() {
    setShowCredentials(true);
    setAuthError("");
  }

  /*
   * Email/password authentication.
   */
  async function handleEmailSubmit(event) {
    event.preventDefault();
    setAuthError("");

    try {
      const result = await signIn({
        email,
        password,
      });

      if (!result.ok) {
        setAuthError(
          result.message || "Sign in failed. Please check your credentials."
        );
        return;
      }

      setPassword("");
    } catch (error) {
      console.error("Email sign-in error:", error);

      setAuthError(
        error?.message ||
          "Sign in failed. Please check your credentials and try again."
      );
    }
  }

  /*
   * Wait for Firebase to determine the current session.
   */
  if (authLoading) {
    return (
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-card">
            <p className="login-kicker">
              Bike Black Box
            </p>

            <h2>Checking authentication...</h2>

            <p className="text-sm text-slate-400">
              Please wait.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * LOGIN SCREEN
   */
  if (!isAuthenticated) {
    return (
      <div className="login-shell">
        <div className="login-panel">

          {/* Branding */}
          <div className="login-branding">
            <div className="login-brand-mark">
              BB
            </div>

            <div>
              <p className="section-kicker">
                Bike Black Box
              </p>

              <h1>Operations access</h1>
            </div>
          </div>

          {/* Login Card */}
          <div className="login-card">
            <p className="login-kicker">
              Secure sign in
            </p>

            <h2>
              {showCredentials
                ? "Welcome back"
                : "Operations access"}
            </h2>

            {!showCredentials ? (
              <>
                {/* Google Login */}
                <button
                  type="button"
                  className="login-button google-button"
                  onClick={handleGoogleContinue}
                >
                  <span className="login-button-icon">
                    G
                  </span>

                  Continue with Google
                </button>

                {authError ? (
                  <p className="login-error">
                    {authError}
                  </p>
                ) : null}

                {/* Divider */}
                <div className="divider">
                  <span>or</span>
                </div>

                {/* Email Login */}
                <button
                  type="button"
                  className="login-switch"
                  onClick={handleEmailOption}
                >
                  Use Email / Password instead
                </button>
              </>
            ) : (
              <>
                <div className="divider">
                  <span>Email / Password</span>
                </div>

                <form
                  onSubmit={handleEmailSubmit}
                  className="login-form"
                >

                  {/* Email */}
                  <label>
                    <span>Email</span>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="you@blackbox.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  {/* Password */}
                  <label>
                    <span>Password</span>

                    <input
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                  </label>

                  {/* Error */}
                  {authError ? (
                    <p className="login-error">
                      {authError}
                    </p>
                  ) : null}

                  {/* Submit */}
                  <button
                    type="submit"
                    className="login-button primary-button"
                  >
                    Sign In
                  </button>

                  {/* Back */}
                  <button
                    type="button"
                    className="login-switch"
                    onClick={() => {
                      setShowCredentials(false);
                      setAuthError("");
                      setPassword("");
                    }}
                  >
                    ← Back to Google sign in
                  </button>

                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /*
   * DASHBOARD
   */
  return (
    <div className="h-screen overflow-hidden bg-[#071018] text-slate-100">

      <div className="flex h-screen min-h-0">

        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden lg:ml-64">

          <Header
            onMenu={() => setSidebarOpen(true)}
          />

          <main className="mx-auto max-w-[1700px] space-y-5 p-4 sm:p-6 xl:p-8">

            {/* Page Header */}
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

              {/* System Status */}
              <div className="flex flex-wrap gap-2 text-xs">

                <SignalPill
                  icon={RadioTower}
                  label={
                    backendOnline
                      ? "API connected"
                      : "API unavailable"
                  }
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

            {/* Backend Error */}
            {!backendOnline ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">

                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {backendError ||
                    "Backend unavailable. Start the API to receive live telemetry."}
                </span>

              </div>
            ) : null}

            {/* Current Page */}
            <Page />

          </main>
        </div>
      </div>

      {/* Accident Alert */}
      <AccidentAlert />

    </div>
  );
}

function SignalPill({
  icon: Icon,
  label,
  good,
}) {
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