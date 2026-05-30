import {
  ArrowLeft,
  BarChart3,
  FileText,
  Moon,
  MessageSquareText,
  Tags,
  Sun,
  Vote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicApi } from "../api/public";
import { translateText } from "../api/translation";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { formatNumber, getErrorMessage } from "../lib/format";
import LanguageSelector from "../components/LanguageSelector";

const TRANSLATION_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "am", label: "Amharic" },
  { code: "om", label: "Oromo" },
  { code: "ti", label: "Tigrinya" },
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

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / total) * 100);
}

function MetricTile({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          {icon}
        </span>
      </div>
    </div>
  );
}

function ResultBar({ label, count, total }) {
  const width = percent(count, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-800">{label}</span>
        <span className="font-semibold text-slate-500">
          {formatNumber(count || 0)} ({width}%)
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function VoteResults({ analytics }) {
  if (analytics.pollType === "binary") {
    return (
      <div className="space-y-4">
        <ResultBar label="Yes" count={analytics.yesCount} total={analytics.totalVotes} />
        <ResultBar label="No" count={analytics.noCount} total={analytics.totalVotes} />
      </div>
    );
  }

  if (analytics.pollType === "approval") {
    return (
      <div className="space-y-4">
        <ResultBar label="Approve" count={analytics.approveCount} total={analytics.totalVotes} />
        <ResultBar label="Reject" count={analytics.rejectCount} total={analytics.totalVotes} />
        <ResultBar label="Abstain" count={analytics.abstainCount} total={analytics.totalVotes} />
      </div>
    );
  }

  if (analytics.pollType === "multipleChoice") {
    return (
      <div className="space-y-4">
        {(analytics.results || []).map((result) => (
          <ResultBar
            key={result.id}
            label={result.text}
            count={result.count}
            total={analytics.totalVotes}
          />
        ))}
      </div>
    );
  }

  if (analytics.pollType === "rating" || analytics.pollType === "likert") {
    return (
      <div className="space-y-4">
        {Object.entries(analytics.distribution || {}).map(([rating, count]) => (
          <ResultBar
            key={rating}
            label={`${rating} star${rating === "1" ? "" : "s"}`}
            count={count}
            total={analytics.totalVotes}
          />
        ))}
      </div>
    );
  }

  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      Results are not available for this poll type yet.
    </p>
  );
}

export function PublicPolicyAnalyticsPage() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);
  const [policyLanguage, setPolicyLanguage] = useState("en");
  const [translatedPolicy, setTranslatedPolicy] = useState(null);
  const [translatingPolicy, setTranslatingPolicy] = useState(false);
  const [translatedComments, setTranslatedComments] = useState({});

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.dataset.uiTheme = theme;
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const isDark = theme === "dark";

  const getCommentText = (comment) =>
    comment?.text || comment?.comment?.text || comment?.content || comment?.body || comment?.message || "";

  const translatePolicyHeader = async () => {
    if (!analytics) return;
    if (translatedPolicy) {
      setTranslatedPolicy(null);
      return;
    }

    setTranslatingPolicy(true);
    setError("");
    try {
      const baseTitle = analytics.title || "Public analytics";
      const baseDescription = analytics.description || "Public policy analytics";
      const [title, description] = await Promise.all([
        translateText({ text: baseTitle, targetLang: policyLanguage }),
        translateText({ text: baseDescription, targetLang: policyLanguage }),
      ]);
      setTranslatedPolicy({ title, description });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to translate public policy text"));
    } finally {
      setTranslatingPolicy(false);
    }
  };

  const setTranslatedComment = (commentId, translatedText) => {
    setTranslatedComments((current) => ({ ...current, [commentId]: translatedText }));
  };

  const revertTranslatedComment = (commentId) => {
    setTranslatedComments((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  };

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setLoading(true);
      setError("");
      try {
        const [analyticsResult, commentsResult] = await Promise.all([
          publicApi.getPolicyAnalytics(id),
          publicApi.getPolicyComments(id),
        ]);
        if (!active) return;
        setAnalytics(analyticsResult);
        setComments(commentsResult.comments || []);
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, "Failed to load public analytics"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();
    return () => {
      active = false;
    };
  }, [id]);

  const displayTitle = translatedPolicy?.title || analytics?.title || "Public analytics";
  const displayDescription = translatedPolicy?.description || analytics?.description || "Public policy analytics";

  if (loading) {
    return (
      <div className="public-policy-analytics min-h-screen bg-slate-50 px-4 py-8" data-theme={theme}>
        <LoadingState label="Loading public analytics" />
      </div>
    );
  }

  return (
    <div className="public-policy-analytics min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8f4eb_100%)] px-4 py-6 text-slate-950 transition-colors duration-200 sm:px-6 lg:px-8" data-theme={theme}>
      <main className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Public page
          </Link>

          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-pressed={isDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <ErrorAlert message={error} />

        {analytics ? (
          <>
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.07)]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
                Vote analytics
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {displayTitle}
              </h1>
              <p className="mt-2 text-sm text-slate-600">{displayDescription}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {analytics.pollType}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={translatePolicyHeader}
                  disabled={translatingPolicy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {translatingPolicy ? "Translating..." : "Translate"}
                </button>
                <select
                  value={policyLanguage}
                  onChange={(event) => setPolicyLanguage(event.target.value)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
                >
                  {TRANSLATION_LANGUAGES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setTranslatedPolicy(null)}
                  disabled={!translatedPolicy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Original
                </button>
              </div>
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <MetricTile
                icon={<Vote className="h-5 w-5" />}
                label="Total votes"
                value={formatNumber(analytics.totalVotes || 0)}
              />
              <MetricTile
                icon={<MessageSquareText className="h-5 w-5" />}
                label="Public comments"
                value={formatNumber(comments.length)}
              />
              <MetricTile
                icon={<BarChart3 className="h-5 w-5" />}
                label={analytics.average != null ? "Average rating" : "Poll type"}
                value={analytics.average != null ? analytics.average : "Results"}
              />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Vote results</h2>
                <div className="mt-5">
                  <VoteResults analytics={analytics} />
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-teal-700" />
                    <h2 className="text-lg font-black text-slate-950">Top keywords</h2>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(analytics.topKeywords || []).length ? (
                      analytics.topKeywords.map((keyword) => (
                        <span
                          key={keyword.keyword}
                          className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700"
                        >
                          {keyword.keyword} ({keyword.count})
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No keywords available yet.</p>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-700" />
                <h2 className="text-lg font-black text-slate-950">Public comments</h2>
              </div>
              <div className="mt-4 space-y-3">
                {comments.length ? (
                  comments.slice(0, 10).map((comment) => (
                    <article key={comment.id} className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm leading-6 text-slate-700">
                        {translatedComments[comment.id] || getCommentText(comment)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <LanguageSelector
                          text={getCommentText(comment)}
                          onTranslated={(translatedText) =>
                            setTranslatedComment(comment.id, translatedText)
                          }
                        />
                        {translatedComments[comment.id] && (
                          <button
                            type="button"
                            onClick={() => revertTranslatedComment(comment.id)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Show original
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No public comments are available yet.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-slate-500">
            Public analytics are not available for this policy.
          </div>
        )}
      </main>
    </div>
  );
}
