import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { policyApi } from "../api/policies";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, getErrorMessage } from "../lib/format";
import { BarChart3, Copy } from "lucide-react";
import { analyticsApi } from "../api/analytics";
import { showToast } from "../lib/toast";
import { Activity, Bell, AlertTriangle, Users } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export function ReadOnlyPolicyDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const p = await policyApi.get(id);
        if (!active) return;
        setPolicy(p);
      } catch (err) {
        if (active) setError(getErrorMessage(err, "Failed to load policy"));
      } finally {
        if (active) setLoading(false);
      }
      try {
        const s = await analyticsApi.summary(id);
        if (!active) return;
        setStats(s);
      } catch (e) {
        // ignore analytics errors
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleClone = async () => {
    setError("");
    try {
      const result = await policyApi.clone(id);
      // Redirect to the edit page of the cloned draft
      showToast("success", t("Policy cloned as a new draft. Redirecting to edit..."));
      navigate(`/policies/${result.id}/edit`);
    } catch (err) {
      setError(getErrorMessage(err, "Clone failed"));
    }
  };

  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>{t("Policy not found")}</div>;

  const showAnalytics = ["active", "paused", "closed", "archived"].includes(
    policy.status,
  );

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{policy.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              <strong className="font-medium">{t("Policy Code:")}</strong> {policy.policyCode} • <strong className="font-medium">{t("Read-only view")}</strong>
            </p>
            <p className="mt-2 text-sm text-slate-600">{policy.description || t("No description provided.")}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-slate-700">{t((policy.targetRegions || [])[0] || "Regional")}</span>
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-slate-700">{t(policy.pollType)}</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{t(policy.status)}</span>
              <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-slate-700">#{(policy._id||id).toString().slice(-6)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showAnalytics && (
              <button
                onClick={() => navigate(`/policies/${id}/analytics`)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <BarChart3 className="h-4 w-4" />
                {t("View Analytics")}
              </button>
            )}
            <button
              onClick={handleClone}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            >
              <Copy className="h-4 w-4" />
              {t("Clone Policy")}
            </button>
            <button onClick={() => navigate('/policies')} className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              ← {t("Back")}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 md:col-span-2">
          <h3 className="text-lg font-bold mb-3">{t("Description")}</h3>
          <p className="text-sm text-slate-700 mb-4">{policy.description || t("No description provided.")}</p>

          <h3 className="text-lg font-bold mb-3">{t("Details")}</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <dt className="font-semibold">{t("Status:")}</dt>
            <dd><StatusBadge status={policy.status} /></dd>

            <dt className="font-semibold">{t("Target Regions:")}</dt>
            <dd>{(policy.targetRegions || []).map((region) => t(region)).join(", ") || t("None")}</dd>

            <dt className="font-semibold">{t("Start Date:")}</dt>
            <dd>{formatDate(policy.startDate)}</dd>

            <dt className="font-semibold">{t("End Date:")}</dt>
            <dd>{formatDate(policy.endDate)}</dd>

            <dt className="font-semibold">{t("Poll Type:")}</dt>
            <dd>{t(policy.pollType)}</dd>

            <dt className="font-semibold">{t("Topics:")}</dt>
            <dd>{(policy.topics || []).map((topic) => t(topic)).join(", ") || t("None")}</dd>

            <dt className="font-semibold">{t("Created By:")}</dt>
            <dd>{policy.createdBy?.email || t("Unknown")}</dd>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <p className="text-xs text-slate-500">{t("Sentiment Counts")}</p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{t("Pos:")} {stats?.sentimentCounts?.positive ?? stats?.positive ?? 0}</div>
            <div className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{t("Neg:")} {stats?.sentimentCounts?.negative ?? stats?.negative ?? 0}</div>
            <div className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">{t("Neu:")} {stats?.sentimentCounts?.neutral ?? stats?.neutral ?? 0}</div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-slate-500">{t("Top Keywords")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(stats?.topKeywords || []).slice(0, 6).map((k, i) => (
                <span key={k?.keyword || i} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{k?.keyword || k}</span>
              ))}
              {(!stats?.topKeywords || stats.topKeywords.length === 0) && (
                <span className="text-sm text-slate-500">{t("No keywords")}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
