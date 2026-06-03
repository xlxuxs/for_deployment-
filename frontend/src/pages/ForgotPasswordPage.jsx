import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { useI18n } from "../i18n/I18nProvider";
import { authApi } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { ErrorAlert } from "../components/ErrorAlert";

export function ForgotPasswordPage() {
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
  const { isAuthenticated, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      // If reCAPTCHA v3 is available, execute and send token
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      let token = null;
      if (siteKey && window.grecaptcha && typeof window.grecaptcha.execute === "function") {
        try {
          token = await window.grecaptcha.execute(siteKey, { action: "forgot_password" });
        } catch (err) {
          // fall through and attempt request without token
          console.warn("grecaptcha execute failed", err);
        }
      }
      await authApi.forgotPassword(email, token);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to send password reset email. Please try again.");
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
        }`}>
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
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Password Reset</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Check your email.</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              We've sent a password reset link to your email address. Click the link to create a new password.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div
            className={`w-full rounded-lg border p-6 shadow-soft sm:p-8 ${
              isDark ? "border-white/10 bg-slate-950/85" : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
              <h2 className={`mt-5 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>Email sent</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Check your inbox for a password reset link.</p>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
              <p className="text-sm text-emerald-800">
                <strong>Email:</strong> {email}
              </p>
              <p className="text-xs text-emerald-700 mt-2">The link will expire in 1 hour.</p>
            </div>

            <div className="space-y-3">
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Didn't receive the email?</p>
              <button
                onClick={() => setSuccess(false)}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-opacity-90 ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Try another email
              </button>
              <Link
                to="/login"
                className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
              >
                Back to Login
              </Link>
            </div>
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
      }`}>
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
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Password Reset</p>
          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Forgot your password?</h1>
          <p className="mt-5 text-lg leading-8 text-teal-50">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
        <div className={`w-full rounded-lg border p-6 shadow-soft sm:p-8 ${isDark ? 'border-white/10 bg-slate-950/85' : 'border-slate-200 bg-white'}`}>
          <div className="mb-8">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
            <h2 className={`mt-5 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>Reset password</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>We'll email you a reset link.</p>
          </div>

          <ErrorAlert message={error} />

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="block flex-1">
                <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={submitting}
                  className={`mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 ${isDark ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500' : 'border-slate-300'}`}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50 md:w-auto md:min-w-48"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </div>
          </form>

          <div className={`mt-6 border-t ${isDark ? 'border-white/10' : 'border-slate-200'} pt-4 text-center`}>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Remember your password? {" "}
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
