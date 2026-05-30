import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowRight, Moon, Sparkles, Sun } from "lucide-react";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { plannerApi } from "../api/planners";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { ErrorAlert } from "../components/ErrorAlert";
import { PasswordField } from "../components/PasswordField";
import { useI18n } from "../i18n/I18nProvider";

const THEME_KEY = "civic_ui_theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";

  try {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export function LoginPage() {
  const { t } = useI18n();
  const { isAuthenticated, initializing, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);
  const [serverError, setServerError] = useState("");
  const [disabledAccount, setDisabledAccount] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealNotice, setAppealNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.uiTheme = theme;
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const isDark = theme === "dark";

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values) => {
    setServerError("");
    setDisabledAccount(false);
    setAppealNotice("");
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        setError(issue.path[0], { message: issue.message });
      });
      return;
    }

    try {
      setSubmitting(true);
      await login(parsed.data.email, parsed.data.password);
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      if (error.code === "ACCOUNT_DISABLED") {
        setDisabledAccount(true);
      }
      setServerError(t(error.message || "Login failed. Check your email and password."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitAppeal = async () => {
    setServerError("");
    setAppealNotice("");
    if (appealReason.trim().length < 20) {
      setServerError(t("Appeal reason must be at least 20 characters."));
      return;
    }
    try {
      setSubmitting(true);
      await plannerApi.submitDeactivationAppeal({
        email: getValues("email"),
        password: getValues("password"),
        reason: appealReason.trim(),
      });
      setAppealReason("");
      setDisabledAccount(false);
      setAppealNotice(t("Your appeal has been submitted. An admin will review it."));
    } catch (error) {
      setServerError(t(error.message || "Failed to submit appeal."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className={`auth-shell min-h-screen transition-colors ${
        isDark
          ? "bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
          : "bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] text-slate-950"
      }`}
      data-theme={theme}
    >
      <div className="flex min-h-screen flex-col">
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
              title={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? t("Light mode") : t("Dark mode")}
            </button>
          </div>
        </div>

        <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:items-stretch">
          <section className="relative hidden min-h-[680px] overflow-hidden lg:block">
            <div
              className={`absolute inset-0 ${
                isDark
                  ? "bg-[radial-gradient(circle_at_top_right,_rgba(94,234,212,0.28),_transparent_18%),linear-gradient(180deg,_#134e4a_0%,_#082f49_100%)]"
                  : "bg-[radial-gradient(circle_at_top_right,_rgba(153,246,228,0.42),_transparent_18%),linear-gradient(180deg,_#115e59_0%,_#134e4a_100%)]"
              }`}
            />
            <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
              <div className="max-w-lg pt-20">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-50">
                  <Sparkles className="h-4 w-4" />
                  {t("Open governance, made simple.")}
                </div>
                <h2 className="mt-8 text-5xl font-black leading-tight tracking-tight">
                  {t("Policy feedback, organized for action.")}
                </h2>
                <p className="mt-6 text-lg leading-8 text-teal-50/90">
                  {t("Use your planner, comment moderator, or admin account.")}
                </p>
              </div>

              <div className="max-w-xl">
                <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-6 backdrop-blur">
                  <p className="text-2xl font-semibold leading-10 text-white">
                    {t("Track policy performance, engagement metrics, and civic participation at a glance.")}
                  </p>
                  <div className="mt-6">
                    <p className="text-sm font-semibold text-white">Civic Platform</p>
                    <p className="mt-1 text-sm text-teal-50/80">{t("Secure sign in")}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`relative flex items-center justify-center p-7 sm:p-10 lg:p-12 ${
              isDark
                ? "border-white/10 bg-slate-950/85"
                : "border-white/80 bg-white/92 backdrop-blur"
            }`}
          >
            <div className="w-full max-w-md">
              <div className="inline-flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-sm font-black text-white shadow-lg shadow-teal-900/20">
                  CP
                </span>
                <div>
                  <p className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-950"}`}>{t("Civic Engagement Platform")}</p>
                </div>
              </div>

              <div className="mt-14 max-w-md">
                <h1 className={`text-4xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
                  {t("Welcome back")}
                </h1>
                <p className={`mt-4 text-base leading-8 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  {t("Sign in as a planner, comment moderator, or admin to manage policies, review public sentiment, and keep participation workflows moving.")}
                </p>
              </div>

              <div className="mt-10">
                <ErrorAlert message={serverError} />
                {appealNotice ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {appealNotice}
                  </div>
                ) : null}

                <form className="mt-2 space-y-5" onSubmit={handleSubmit(onSubmit)}>
                  <label className="block">
                    <span className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>{t("Email")}</span>
                    <input
                      className={`mt-1.5 w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${
                        isDark
                          ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                          : "border-slate-300 bg-white text-slate-950"
                      }`}
                      type="email"
                      autoComplete="email"
                      placeholder={t("Enter your email")}
                      {...register("email")}
                    />
                    {errors.email ? <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.email.message}</span> : null}
                  </label>

                  <PasswordField
                    label={<span className={isDark ? "text-slate-200" : "text-slate-700"}>{t("Password")}</span>}
                    autoComplete="current-password"
                    error={errors.password?.message}
                    wrapperClassName="block"
                    inputClassName={
                      isDark
                        ? "rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:ring-teal-500/20"
                        : "rounded-2xl"
                    }
                    placeholder={t("Enter your password")}
                    {...register("password")}
                  />

                  <div className="flex items-center justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-semibold text-teal-600 transition hover:text-teal-500"
                    >
                      {t("Forgot password?")}
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800 disabled:opacity-60"
                  >
                    {submitting ? t("Signing in...") : t("Login")}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                {disabledAccount ? (
                  <div className={`mt-6 rounded-[1.5rem] border p-4 ${isDark ? "border-amber-400/20 bg-amber-500/10" : "border-amber-200 bg-amber-50"}`}>
                    <p className={`text-sm font-bold ${isDark ? "text-amber-200" : "text-amber-900"}`}>
                      {t("Appeal deactivation")}
                    </p>
                    <textarea
                      rows="4"
                      value={appealReason}
                      onChange={(event) => setAppealReason(event.target.value)}
                      placeholder={t("Explain why your account should be reactivated.")}
                      className={`mt-3 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 ${
                        isDark
                          ? "border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                          : "border-amber-200 bg-white"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={submitAppeal}
                      className="mt-3 rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {t("Submit appeal")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
