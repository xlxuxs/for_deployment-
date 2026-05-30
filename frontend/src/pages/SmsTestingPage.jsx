import {
  Globe2,
  LocateFixed,
  Moon,
  RefreshCw,
  Search,
  SendHorizontal,
  Smartphone,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { smsStudioApi } from "../api/smsStudio";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { ETHIOPIAN_REGIONS, LANGUAGES } from "../constants/regions";
import { useI18n } from "../i18n/I18nProvider";
import { getErrorMessage } from "../lib/format";

const QUICK_COMMANDS = [
  "SUBSCRIBE",
  "POLICIES",
  "MYVOTES",
  "STOP",
];

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

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildThread(activities) {
  return [...activities]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .flatMap((item) => {
      if (item.direction === "outbound") {
        return [
          {
            id: `${item._id}-outbound`,
            side: "left",
            body: item.replyMessage,
            timestamp: item.createdAt,
            tone: item.success ? "system" : "error",
            label: item.command || "SYSTEM",
          },
        ];
      }

      return [
        {
          id: `${item._id}-user`,
          side: "right",
          body: item.inboundMessage || "",
          timestamp: item.createdAt,
          tone: "user",
          label: "YOU",
        },
        {
          id: `${item._id}-reply`,
          side: "left",
          body: item.replyMessage,
          timestamp: item.createdAt,
          tone: item.success ? "system" : "error",
          label: item.command || "SMS",
        },
      ];
    })
    .filter((item) => item.body);
}

export function SmsTestingPage() {
  const { t, locale } = useI18n();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activities, setActivities] = useState([]);
  const [formPhone, setFormPhone] = useState("+251966000001");
  const [message, setMessage] = useState("SUBSCRIBE");
  const [preferredLanguage, setPreferredLanguage] = useState(locale || "en");
  const [region, setRegion] = useState("Addis Ababa");
  const [subscriptionState, setSubscriptionState] = useState(null);

  async function loadHistory(query = searchQuery, { blocking = false } = {}) {
    if (blocking) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");
    try {
      const result = await smsStudioApi.history({ q: query || undefined });
      setActivities(result.activities || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load SMS history"));
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHistory("", { blocking: true });
  }, []);

  useLayoutEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.uiTheme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    } catch {
      // Ignore storage or DOM errors.
    }
  }, [theme]);

  useEffect(() => {
    setPreferredLanguage(locale || "en");
  }, [locale]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await smsStudioApi.simulate({
        phone: formPhone,
        message,
        preferredLanguage,
        region,
      });
      setSubscriptionState(result.subscription || null);
      setMessage("");
      await loadHistory(searchQuery);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to simulate SMS"));
    } finally {
      setSubmitting(false);
    }
  }

  const thread = useMemo(() => buildThread(activities), [activities]);
  const isDark = theme === "dark";

  if (initialLoading) {
    return <LoadingState label={t("Loading SMS testing tools")} />;
  }

  return (
    <div className="public-sms-studio space-y-6 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.12),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-3 py-3 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.14),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-soft backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title={t("SMS Studio")}
          description={t("A focused mock SMS workspace with chat-style simulation, searchable message history, and region-aware policy testing.")}
        />

        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold transition sm:self-auto ${
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          aria-pressed={isDark}
          title={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{isDark ? t("Light mode") : t("Dark mode")}</span>
        </button>
      </div>

      <ErrorAlert message={error} />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-sky-100 text-teal-700 shadow-inner dark:from-teal-500/20 dark:to-sky-500/10 dark:text-teal-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black text-slate-950 dark:text-white">{t("Session setup")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("Choose the phone, region, and language before sending mock SMS commands.")}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("Phone number")}</span>
              <input
                value={formPhone}
                onChange={(event) => setFormPhone(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-teal-500/20"
                placeholder="+251966000001"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Globe2 className="h-4 w-4" />
                {t("Preferred Language")}
              </span>
              <select
                value={preferredLanguage}
                onChange={(event) => setPreferredLanguage(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-teal-500/20"
              >
                {LANGUAGES.filter((item) => item.value !== "all").map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <LocateFixed className="h-4 w-4" />
                {t("Region")}
              </span>
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-teal-500/20"
              >
                {ETHIOPIAN_REGIONS.map((item) => (
                  <option key={item} value={item}>
                    {t(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t("Current SMS identity")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("These preferences are saved when the phone subscribes.")}</p>
              </div>
              <Smartphone className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t("Language")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t(LANGUAGES.find((item) => item.value === preferredLanguage)?.label || "English")}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t("Region")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{t(region)}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t("Subscription")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {subscriptionState?.subscribed ? t("Subscribed") : t("Waiting")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t("Quick commands")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("Tap a command to load it into the composer.")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {QUICK_COMMANDS.map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => setMessage(command)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10"
                >
                  {command}
                </button>
              ))}

            </div>
          </div>
        </aside>

        <section className="rounded-[2.5rem] border border-white/70 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_38%),linear-gradient(180deg,_#f8fbff_0%,_#eef3fb_100%)] p-4 shadow-soft backdrop-blur-xl dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.12),_transparent_38%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
          <div className="mx-auto max-w-[430px] rounded-[3rem] border-[10px] border-slate-950 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] dark:bg-slate-900">
            <div className="mx-auto mt-3 h-6 w-36 rounded-full bg-slate-950 dark:bg-slate-200" />

            <div className="border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950 dark:text-white">{t("Civic SMS")}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(region)} • {t(LANGUAGES.find((item) => item.value === preferredLanguage)?.label || "English")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadHistory()}
                  disabled={refreshing}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label={t("Refresh")}
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>

              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      loadHistory();
                    }
                  }}
                  placeholder={t("Search SMS history")}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-teal-500/20"
                />
              </label>
            </div>

            <div className="h-[620px] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.95))] px-4 py-5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
              {refreshing && (
                <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  {t("Refreshing SMS history")}
                </div>
              )}
              {thread.length ? (
                <div className="space-y-3">
                  {thread.map((item) => {
                    const isRight = item.side === "right";
                    const bubbleClass = isRight
                      ? "bg-blue-500 text-white"
                      : item.tone === "error"
                        ? "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-100 dark:border-rose-500/30"
                        : "bg-white text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700";

                    return (
                      <div
                        key={item.id}
                        className={`flex ${isRight ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[82%] rounded-[1.6rem] px-4 py-3 shadow-sm ${bubbleClass}`}>
                          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isRight ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}`}>
                            {item.label}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                          <p className={`mt-2 text-[11px] ${isRight ? "text-blue-100/90" : "text-slate-400 dark:text-slate-500"}`}>
                            {formatMessageTime(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid h-full place-items-center">
                  <EmptyState
                    title={t("No SMS activity yet")}
                    description={t("Simulated SMS history will appear here.")}
                  />
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-slate-950 px-4 py-4 dark:border-slate-800"
            >
              <div className="flex items-center gap-3 rounded-full bg-slate-900 px-3 py-2 ring-1 ring-white/10">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("Type SUBSCRIBE, POLICIES, or a vote...")}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t("Send")}
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
