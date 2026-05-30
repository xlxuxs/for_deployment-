import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  Moon,
  Rocket,
  ShieldCheck,
  Sun,
  Vote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { plannerApi } from "../api/planners";
import { publicApi } from "../api/public";
import { ErrorAlert } from "../components/ErrorAlert";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { LoadingState } from "../components/LoadingState";
import { ETHIOPIAN_REGIONS, LANGUAGES } from "../constants/regions";
import { useI18n } from "../i18n/I18nProvider";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  region: "",
  ageRange: "25-34",
  gender: "prefer-not-to-say",
  occupation: "government-employee",
  education: "bachelors",
  preferredLanguage: "en",
  languagesSpoken: ["en"],
  organization: "",
  reason: "",
  proofFile: null,
};

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const OCCUPATIONS = [
  { value: "student", label: "Student" },
  { value: "farmer", label: "Farmer" },
  { value: "merchant", label: "Merchant" },
  { value: "government-employee", label: "Government Employee" },
  { value: "private-sector", label: "Private Sector" },
  { value: "unemployed", label: "Unemployed" },
  { value: "other", label: "Other" },
];

const EDUCATIONS = [
  { value: "no-formal", label: "No Formal Education" },
  { value: "primary", label: "Primary School" },
  { value: "secondary", label: "Secondary School" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's Degree" },
  { value: "postgraduate", label: "Postgraduate Degree" },
];

const LANGUAGE_OPTIONS = LANGUAGES.filter((language) => language.value !== "all");
const SPOKEN_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS;
const MAX_PROOF_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const APP_DOWNLOAD_URL = import.meta.env.VITE_MOBILE_APP_URL || "https://drive.google.com/file/d/1IoDB_fscGSJHmlS8jR05GFoxA8joJuh7/view?usp=drive_link";

const navigationItems = [
  { label: "Overview", href: "#overview" },
  { label: "Planner access", href: "#planner-request" },
  { label: "Download", href: "https://drive.google.com/file/d/1IoDB_fscGSJHmlS8jR05GFoxA8joJuh7/view?usp=drive_link" },
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

function approximateCount(value, fallback = "10+") {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const rounded = Math.max(5, Math.round(value / 5) * 5);
  return `${rounded}+`;
}

function toggleSpokenLanguage(currentLanguages, language) {
  if (currentLanguages.includes(language)) {
    return currentLanguages.filter((item) => item !== language);
  }

  return [...currentLanguages, language];
}

function SentimentBar({ policy }) {
  const { t } = useI18n();
  const total = policy.sentiment.positive + policy.sentiment.negative + policy.sentiment.neutral;
  if (!total) {
    return <p className="text-xs text-slate-500">{t("No public sentiment data yet.")}</p>;
  }

  const positive = Math.round((policy.sentiment.positive / total) * 100);
  const neutral = Math.round((policy.sentiment.neutral / total) * 100);
  const negative = Math.max(0, 100 - positive - neutral);

  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full w-full">
          <div className="bg-emerald-500" style={{ width: `${positive}%` }} />
          <div className="bg-amber-400" style={{ width: `${neutral}%` }} />
          <div className="bg-rose-500" style={{ width: `${negative}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
          {t("Positive")} {approximateCount(policy.sentiment.positive, "5+")}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
          {t("Neutral")} {approximateCount(policy.sentiment.neutral, "5+")}
        </span>
        <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">
          {t("Negative")} {approximateCount(policy.sentiment.negative, "5+")}
        </span>
      </div>
    </div>
  );
}

export function PublicLandingPage() {
  const { t } = useI18n();
  const [landingData, setLandingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [theme, setTheme] = useState(getInitialTheme);
  const proofFileRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.uiTheme = theme;
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const isDark = theme === "dark";

  useEffect(() => {
    let active = true;

    async function loadLanding() {
      setLoading(true);
      setError("");
      try {
        const result = await publicApi.getLandingData();
        if (active) {
          setLandingData(result);
        }
      } catch (err) {
        if (active) {
          setError(t(getErrorMessage(err, "Failed to load public dashboard")));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLanding();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () =>
      landingData?.summary || {
        closedPolicies: 0,
        totalVotes: 0,
        totalComments: 0,
      },
    [landingData?.summary],
  );

  const policies = landingData?.policies || [];

  const topHighlights = useMemo(
    () => [
      { label: t("Closed policies"), value: approximateCount(summary.closedPolicies, "10+"), icon: Vote },
      { label: t("Votes counted"), value: approximateCount(summary.totalVotes, "50+"), icon: BarChart3 },
      { label: t("Public comments"), value: approximateCount(summary.totalComments, "150+"), icon: FileText },
      { label: t("Live policy results"), value: t("Always visible"), icon: ShieldCheck },
    ],
    [summary, t],
  );

  const overviewCards = useMemo(
    () => [
      {
        label: "Closed policies",
        value: approximateCount(summary.closedPolicies, "10+"),
        detail: "Policies with published outcomes",
        icon: Vote,
      },
      {
        label: "Total votes",
        value: approximateCount(summary.totalVotes, "50+"),
        detail: "Citizen decisions counted across the platform",
        icon: BarChart3,
      },
      {
        label: "Public comments",
        value: approximateCount(summary.totalComments, "150+"),
        detail: "Feedback collected from communities",
        icon: FileText,
      },
    ],
    [summary],
  );

  async function submitPlannerRequest(event) {
    event.preventDefault();
    setError("");

    if (!form.fullName.trim()) {
      setError(t("Please enter your full name."));
      return;
    }

    if (!form.email.trim()) {
      setError(t("Please enter your email address."));
      return;
    }

    if (!form.phone.trim()) {
      setError(t("Please enter your phone number."));
      return;
    }

    if (!form.region.trim()) {
      setError(t("Please select a region."));
      return;
    }

    if (!form.ageRange.trim()) {
      setError(t("Please select an age range."));
      return;
    }

    if (!form.gender.trim()) {
      setError(t("Please select a gender."));
      return;
    }

    if (!form.occupation.trim()) {
      setError(t("Please select an occupation."));
      return;
    }

    if (!form.education.trim()) {
      setError(t("Please select an education level."));
      return;
    }

    if (!form.preferredLanguage.trim()) {
      setError(t("Please select your preferred language."));
      return;
    }

    if (!form.languagesSpoken.length) {
      setError(t("Please select at least one spoken language."));
      return;
    }

    if (!form.organization.trim()) {
      setError(t("Please enter your organization."));
      return;
    }

    if (!form.reason.trim()) {
      setError(t("Please enter your reason for requesting planner access."));
      return;
    }

    if (form.reason.trim().length < 50) {
      setError(t("Reason must be at least 50 characters."));
      return;
    }

    if (!form.proofFile) {
      setError(t("Please upload a supporting proof file."));
      return;
    }

    if (form.proofFile.size > MAX_PROOF_FILE_SIZE_BYTES) {
      setError(t("Proof file must be 5 MB or smaller."));
      return;
    }

    if (!ALLOWED_PROOF_FILE_TYPES.has(form.proofFile.type)) {
      setError(t("Proof file must be an image, PDF, DOC, or DOCX file."));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("applicantType", "nonCitizen");
      formData.append("fullName", form.fullName.trim());
      formData.append("email", form.email.trim());
      formData.append("phone", form.phone.trim());
      formData.append("region", form.region);
      formData.append("ageRange", form.ageRange);
      formData.append("gender", form.gender);
      formData.append("occupation", form.occupation);
      formData.append("education", form.education);
      formData.append("preferredLanguage", form.preferredLanguage);
      formData.append("languagesSpoken", form.languagesSpoken.join(","));
      formData.append("organization", form.organization.trim());
      formData.append("reason", form.reason.trim());
      formData.append("proofFile", form.proofFile);

      await plannerApi.requestPlannerPublic(formData);
      setForm(initialForm);
      if (proofFileRef.current) {
        proofFileRef.current.value = "";
      }
      showToast("success", t("Planner request submitted."));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit planner request"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleProofFileChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setForm((current) => ({ ...current, proofFile: null }));
      return;
    }

    if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
      setError(t("Proof file must be 5 MB or smaller."));
      event.target.value = "";
      setForm((current) => ({ ...current, proofFile: null }));
      return;
    }

    if (!ALLOWED_PROOF_FILE_TYPES.has(file.type)) {
      setError(t("Proof file must be an image, PDF, DOC, or DOCX file."));
      event.target.value = "";
      setForm((current) => ({ ...current, proofFile: null }));
      return;
    }

    setError("");
    setForm((current) => ({ ...current, proofFile: file }));
  }

  return (
    <div
      className="public-dashboard min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.10),_transparent_26%),linear-gradient(180deg,_#fffdf8_0%,_#f8f4eb_100%)] text-slate-950 transition-colors duration-200"
      data-theme={theme}
    >

      {/* Full-bleed modern hero/header */}
      <header className="w-full min-h-screen bg-gradient-to-br from-teal-600/95 via-emerald-500/80 to-teal-400/60 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{background: 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.06), transparent 20%), radial-gradient(circle at 90% 80%, rgba(0,0,0,0.06), transparent 25%)'}} />
        <div className="relative z-10">
          <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white/20 text-white">
                <Globe2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/90">{t("Civic Platform")}</p>
              </div>
            </div>
            <nav className="flex items-center gap-3 text-sm font-semibold">
              {navigationItems.map((item) => (
                <a key={item.label} href={item.href} className="rounded-full px-3 py-2 text-white/90 hover:bg-white/10 transition">
                  {t(item.label)}
                </a>
              ))}
              <LocaleSwitcher />
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="ml-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/20 transition"
                aria-pressed={isDark}
                title={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="sr-only">{isDark ? t("Light mode") : t("Dark mode")}</span>
              </button>
            </nav>
          </div>

          <div className="mx-auto max-w-7xl px-6 py-24 lg:py-32 flex flex-col-reverse lg:flex-row items-center gap-12">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl drop-shadow-md">
                {t("Open governance, made simple.")}
              </h1>
              <p className="mt-4 text-lg text-white/90 max-w-xl leading-relaxed">
                {t("A transparent civic platform for policy making, public feedback and data-driven decisions. Join your community and make your voice count.")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-teal-700 hover:shadow-lg transition">
                  <Download className="h-4 w-4" />
                  {t("Download the app")}
                </a>
                <a href="#planner-request" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white/95 hover:bg-white/10 transition">
                  <Rocket className="h-4 w-4" />
                  {t("Request planner access")}
                </a>
              </div>
            </div>

            <div className="w-full lg:w-1/3 grid gap-4 sm:grid-cols-2">
              {topHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/20">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/20 text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{item.label}</p>
                        <p className="mt-1 text-lg font-extrabold text-white">{item.value}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-white/6 blur-3xl" />
          <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-white/8 blur-2xl" />
        </div>
      </header>

          <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <ErrorAlert message={error} />

        {loading ? (
          <div className="mt-6">
            <LoadingState label="Loading public dashboard" />
          </div>
        ) : (
          <>
            <section id="overview" className="mt-6 grid min-h-screen w-full gap-6 lg:grid-cols-2">
              <div className={`flex h-full flex-col justify-center rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(15,23,42,0.07)] sm:p-8 ${isDark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">
                  <Globe2 className="h-3.5 w-3.5" />
                  {t("Overview")}
                </div>
                <div className="mt-4 max-w-3xl">
                  <h2 className="text-3xl font-black tracking-tight">{t("Trusted public participation, visible in one place.")}</h2>
                  <p className={`mt-3 text-sm leading-7 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("Explore platform activity, review closed policy outcomes, and understand how public input is shaping civic decisions across communities.")}
                  </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {overviewCards.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className={`rounded-[1.5rem] border p-5 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50/80"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className={`grid h-11 w-11 place-items-center rounded-2xl ${isDark ? "bg-teal-500/15 text-teal-300" : "bg-teal-50 text-teal-700"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ${isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-500"}`}>
                            {t(item.label)}
                          </span>
                        </div>
                        <p className={`mt-5 text-3xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>{item.value}</p>
                        <p className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>{t(item.detail)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex h-full flex-col justify-center rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_42%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-teal-50">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("Public pulse")}
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight">{t("See the civic story behind every result.")}</h3>
                <p className="mt-3 text-sm leading-7 text-teal-50/85">
                  {t("Each closed policy brings together participation, sentiment, and local context so the public can understand what happened and what comes next.")}
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    "Review top closed policy outcomes",
                    "See public sentiment and vote summaries",
                    "Follow regional participation at a glance",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-200" />
                      <p className="text-sm text-white/90">{t(item)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`mt-6 min-h-screen w-full rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(15,23,42,0.07)] ${isDark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">{t("Closed vote analytics")}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">{t("Top 10 closed policies")}</h2>
                  <p className={`mt-2 max-w-3xl text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("Browse the closed policies and view their result summaries directly on this page.")}
                  </p>
                </div>
              </div>

              <div className="mt-6" id="analytics">
                <div className="space-y-4">
                  {policies.length ? (
                    policies.map((policy) => {
                      return (
                        <article
                          key={policy.id}
                          className={`w-full rounded-[1.6rem] border p-4 text-left transition ${isDark ? "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800" : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white"}`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isDark ? "bg-teal-500/15 text-teal-200" : "bg-slate-950 text-white"}`}>{t("Closed policy")}</span>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{t("Result available")}</span>
                              </div>
                              <p className={`mt-3 truncate text-lg font-bold ${isDark ? "text-white" : "text-slate-950"}`}>{policy.title}</p>
                              <p className={`mt-2 line-clamp-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{policy.description}</p>
                              <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                                {policy.policyCode} • {(policy.targetRegions || []).map((region) => t(region)).join(", ") || t("All regions")} • {t("Closed")} {formatDate(policy.endDate)}
                              </p>
                            </div>

                            <div className="grid min-w-[180px] gap-2 text-sm">
                              <div className={`rounded-2xl px-3 py-2 shadow-sm ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
                                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-400"}`}>{t("Votes")}</p>
                                <p className={`mt-1 text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>{approximateCount(policy.voteCount, "5+")}</p>
                              </div>
                              <div className={`rounded-2xl px-3 py-2 shadow-sm ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
                                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-400"}`}>{t("Comments")}</p>
                                <p className={`mt-1 text-lg font-black ${isDark ? "text-white" : "text-slate-950"}`}>{approximateCount(policy.commentCount, "10+")}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <SentimentBar policy={policy} />
                            <Link
                              to={`/public/policies/${policy.id}/analytics`}
                              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800"
                            >
                              <BarChart3 className="h-4 w-4" />
                              {t("Analytics")}
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-slate-500">
                      {t("No closed policies are available yet.")}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 space-y-6">
              <section
                id="planner-request"
                className={`min-h-screen w-full overflow-hidden rounded-[2rem] border shadow-[0_20px_60px_rgba(15,23,42,0.06)] ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}
              >
                <div className="grid gap-0 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
                  <div className="bg-[linear-gradient(160deg,#115e59_0%,#0f766e_42%,#134e4a_100%)] p-6 text-white sm:p-8">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-teal-100">
                      <Rocket className="h-3.5 w-3.5" />
                      {t("Planner access")}
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight">{t("Become a planner without creating an account.")}</h2>
                    <p className="mt-3 text-sm leading-7 text-teal-50/90">
                      {t("No account creation first. Send your request and an admin can review it.")}
                    </p>

                    <div className="mt-8 space-y-3">
                      {[
                        "Submit your profile and supporting document",
                        "Admins review your request before approval",
                        "Approved planners can start managing policies",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-200" />
                          <p className="text-sm text-white/90">{t(item)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">{t("Application checklist")}</p>
                      <div className="mt-4 space-y-3 text-sm text-white/90">
                        <p>{t("Full identity and contact information")}</p>
                        <p>{t("Region, language, and background details")}</p>
                        <p>{t("A support file and a clear application reason")}</p>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 sm:p-8 ${isDark ? "text-white" : "text-slate-950"}`}>
                    <div className="max-w-3xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">{t("Request planner access")}</p>
                      <h3 className={`mt-3 text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>{t("Send your planner application")}</h3>
                      <p className={`mt-2 text-sm leading-7 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {t("Share the information your review team needs so they can verify your request quickly and accurately.")}
                      </p>
                    </div>

                    <form onSubmit={submitPlannerRequest} className="mt-6 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <input
                          value={form.fullName}
                          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-950"}`}
                          placeholder={t("Full name")}
                          autoComplete="name"
                        />
                        <input
                          type="email"
                          value={form.email}
                          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-950"}`}
                          placeholder={t("Email address")}
                          autoComplete="email"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={form.phone}
                          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-950"}`}
                          placeholder={t("Phone number (+251 9XX XXX XXX)")}
                          autoComplete="tel"
                        />
                        <select
                          value={form.region}
                          onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-950"}`}
                        >
                          <option value="">{t("Select region")}</option>
                          {ETHIOPIAN_REGIONS.map((region) => (
                            <option key={region} value={region}>
                              {t(region)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <select
                          value={form.ageRange}
                          onChange={(event) => setForm((current) => ({ ...current, ageRange: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-950"}`}
                        >
                          <option value="">{t("Select age range")}</option>
                          {AGE_RANGES.map((ageRange) => (
                            <option key={ageRange} value={ageRange}>
                              {ageRange}
                            </option>
                          ))}
                        </select>
                        <select
                          value={form.gender}
                          onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-950"}`}
                        >
                          <option value="">{t("Select gender")}</option>
                          {GENDERS.map((gender) => (
                            <option key={gender.value} value={gender.value}>
                              {t(gender.label)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <select
                          value={form.occupation}
                          onChange={(event) => setForm((current) => ({ ...current, occupation: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-950"}`}
                        >
                          <option value="">{t("Select occupation")}</option>
                          {OCCUPATIONS.map((occupation) => (
                            <option key={occupation.value} value={occupation.value}>
                              {t(occupation.label)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={form.education}
                          onChange={(event) => setForm((current) => ({ ...current, education: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                        >
                          <option value="">{t("Select education")}</option>
                          {EDUCATIONS.map((education) => (
                            <option key={education.value} value={education.value}>
                              {t(education.label)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                        <select
                          value={form.preferredLanguage}
                          onChange={(event) => setForm((current) => ({ ...current, preferredLanguage: event.target.value }))}
                          className={`min-h-[220px] w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-950"}`}
                        >
                          <option value="">{t("Preferred language")}</option>
                          {LANGUAGE_OPTIONS.map((language) => (
                            <option key={language.value} value={language.value}>
                              {t(language.label)}
                            </option>
                          ))}
                        </select>
                        <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {t("Languages spoken")}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {SPOKEN_LANGUAGE_OPTIONS.map((language) => {
                              const checked = form.languagesSpoken.includes(language.value);
                              return (
                                <label
                                  key={language.value}
                                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${checked ? "border-teal-600 bg-teal-50 text-teal-900" : isDark ? "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setForm((current) => ({
                                        ...current,
                                        languagesSpoken: toggleSpokenLanguage(current.languagesSpoken, language.value),
                                      }))
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                                  />
                                  <span className="font-medium">{t(language.label)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <input
                        value={form.organization}
                        onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-950"}`}
                        placeholder={t("Organization")}
                      />

                      <input
                        type="file"
                        id="planner-proof-file"
                        ref={proofFileRef}
                        required
                        aria-label={t("Supporting proof file")}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleProofFileChange}
                        className="sr-only"
                      />
                      <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 text-sm outline-none transition ${isDark ? "border-slate-700 hover:bg-slate-900" : "border-slate-300 hover:bg-slate-50"}`} htmlFor="planner-proof-file">
                        <span className="rounded-xl bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">{t("Choose File")}</span>
                        <span className={isDark ? "text-slate-300" : "text-slate-600"}>{form.proofFile?.name || t("No file chosen")}</span>
                      </label>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {t("Upload an image, PDF, DOC, or DOCX file up to 5 MB.")}
                      </p>

                      <textarea
                        rows="6"
                        value={form.reason}
                        onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 ${isDark ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-950"}`}
                        placeholder={t("Reason")}
                      />

                      <div className={`flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                        <p className={`text-xs leading-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {t("Applications are reviewed manually to protect policy quality and platform trust.")}
                        </p>
                        <button
                          disabled={submitting}
                          type="submit"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          <ArrowRight className="h-4 w-4" />
                          {submitting ? t("Submitting...") : t("Send planner request")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>

              {/* download card removed per request; download actions now go directly to the resource */}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
