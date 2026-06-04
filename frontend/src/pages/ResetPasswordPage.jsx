import { useSearchParams, Navigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../auth/AuthContext";
import { authApi } from "../api/auth";
import { ErrorAlert } from "../components/ErrorAlert";
import { PasswordField } from "../components/PasswordField";

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

export function ResetPasswordPage() {
  const { isAuthenticated, initializing } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { t } = useI18n();
  const THEME_KEY = "civic_ui_theme";

  function getInitialTheme() {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "dark";
    }
  }

  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.uiTheme = theme;
    } catch {}
  }, [theme]);
  const isDark = theme === "dark";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!token) {
    return (
      <main
        className={`auth-shell grid min-h-screen transition-colors ${
          isDark
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
            : "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950"
        }`}
      >
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                isDark
                  ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  : "border-slate-200 bg-white/80 text-slate-700 backdrop-blur hover:bg-white"
              }`}
              aria-pressed={isDark}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? t("Light mode") : t("Dark mode")}
            </button>
          </div>
        </div>
        <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Error</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Invalid link</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              This password reset link is missing or has expired. Please request a new one.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div className={`w-full rounded-lg border p-6 shadow-soft sm:p-8 ${isDark ? 'border-white/10 bg-slate-950/85' : 'border-slate-200 bg-white'}`}>
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-rose-700 text-sm font-black text-white">!</span>
              <h2 className={`mt-5 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>Invalid link</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>The reset link is missing or expired.</p>
            </div>

            <div className="space-y-3">
              <Link
                to="/forgot-password"
                className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
              >
                Request new reset link
              </Link>
              <Link
                to="/login"
                className="block text-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main
        className={`auth-shell grid min-h-screen transition-colors ${
          isDark
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
            : "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950"
        }`}
      >
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                isDark
                  ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  : "border-slate-200 bg-white/80 text-slate-700 backdrop-blur hover:bg-white"
              }`}
              aria-pressed={isDark}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? t("Light mode") : t("Dark mode")}
            </button>
          </div>
        </div>

        <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Success</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Password reset!</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              Your password has been successfully reset. Sign in with your new password.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div className={`w-full rounded-lg border p-6 shadow-soft sm:p-8 ${isDark ? 'border-white/10 bg-slate-950/85' : 'border-slate-200 bg-white'}`}>
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">✓</span>
              <h2 className={`mt-5 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>Password reset</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Your password has been updated.</p>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
              <p className="text-sm text-emerald-800">
                You can now sign in with your new password.
              </p>
            </div>

            <Link
              to="/login"
              className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
            >
              Back to login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`auth-shell grid min-h-screen transition-colors ${
        isDark
          ? "bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
          : "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950"
      }`}
    >
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <div className="flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
              isDark
                ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                : "border-slate-200 bg-white/80 text-slate-700 backdrop-blur hover:bg-white"
            }`}
            aria-pressed={isDark}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? t("Light mode") : t("Dark mode")}
          </button>
        </div>
      </div>

      <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Create new password</p>
          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Reset your password</h1>
          <p className="mt-5 text-lg leading-8 text-teal-50">
            Enter a strong new password. Make sure it's different from before.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
        <div className={`w-full rounded-lg border p-6 shadow-soft sm:p-8 ${isDark ? 'border-white/10 bg-slate-950/85' : 'border-slate-200 bg-white'}`}>
          <div className="mb-8">
            <img
              src={isDark ? "/logo-icon-white.png" : "/logo-icon.png"}
              alt="Civic Voice Logo"
              className="h-12 w-12 object-contain"
            />
            <h2 className={`mt-5 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>New password</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{PASSWORD_REQUIREMENTS_MESSAGE}</p>
          </div>

          <ErrorAlert message={error} />

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <PasswordField
              label={isDark ? "New password" : "New password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
              helperText={PASSWORD_REQUIREMENTS_MESSAGE}
            />

            <PasswordField
              label={isDark ? "Confirm password" : "Confirm password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <div className={`mt-6 border-t ${isDark ? 'border-white/10' : 'border-slate-200'} pt-4 text-center`}>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <Link to="/login" className="font-bold text-teal-700 hover:underline">
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
