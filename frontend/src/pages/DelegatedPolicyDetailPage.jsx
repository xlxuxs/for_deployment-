import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { policyApi } from "../api/policies";
import { plannerApi } from "../api/plannerApi";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { Tabs, TabPane } from "../components/Tabs";
import { formatDate, getErrorMessage } from "../lib/format";
import { BarChart3, LogOut, AlertCircle } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export function DelegatedPolicyDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);
  const [associateId, setAssociateId] = useState(null);
  const [invitationMessage, setInvitationMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [policyData, delegated] = await Promise.all([
          policyApi.get(id),
          plannerApi.getMyAssociatePolicies(),
        ]);
        const match = delegated.find((d) => d.policy?._id === id);
        if (!match) {
          throw new Error("You are not an associate for this policy.");
        }

        setPolicy(policyData);
        setAssociateId(match.associateId);
        setInvitationMessage(match.message || "");
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load policy"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSelfRevoke = async () => {
    if (!associateId) return;
    if (
      !window.confirm(
        "Are you sure you want to leave this policy? You will lose associate access.",
      )
    )
      return;
    try {
      await plannerApi.removeSelfAsAssociate(associateId);
      alert("You have been removed as an associate.");
      navigate("/associates/policies");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to leave policy"));
    }
  };

  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>{t("Policy not found")}</div>;

  const analyticsAvailable = ["active", "paused", "closed"].includes(
    policy.status,
  );
  const tabs = [{ id: "info", label: t("Policy Info") }];

  return (
    <div>
      <PageHeader
        title={policy.title}
        description={`${t("Policy Code:")} ${policy.policyCode} • ${t("You are an associate")}`}
        actions={
          <div className="flex gap-2">
            {analyticsAvailable && (
              <button
                onClick={() => navigate(`/policies/${id}/analytics`)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
              >
                <BarChart3 className="h-4 w-4" />
                {t("View Analytics")}
              </button>
            )}
            <button
              onClick={handleSelfRevoke}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              {t("Leave Policy")}
            </button>
          </div>
        }
      />
      <ErrorAlert message={error} />

      {!analyticsAvailable && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{t("Policy not yet ready for analytics")}</p>
              <p className="text-sm">
                {t("This policy is currently")} {t(policy.status)}. {t("Analytics will be available once the policy becomes active.")}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={tabs} defaultTab="info">
        <TabPane tabId="info">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            {invitationMessage && (
              <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
                <p className="font-semibold">{t("Invitation Message")}</p>
                <p className="mt-1 whitespace-pre-wrap">{invitationMessage}</p>
              </div>
            )}
            <dl className="grid gap-2 sm:grid-cols-2">
              <dt className="font-semibold">{t("Status:")}</dt>
              <dd>
                <StatusBadge status={policy.status} />
              </dd>
              <dt className="font-semibold">{t("Target Regions:")}</dt>
              <dd>{policy.targetRegions?.map((region) => t(region)).join(", ") || t("None")}</dd>
              <dt className="font-semibold">{t("Start Date:")}</dt>
              <dd>{formatDate(policy.startDate)}</dd>
              <dt className="font-semibold">{t("End Date:")}</dt>
              <dd>{formatDate(policy.endDate)}</dd>
              <dt className="font-semibold">{t("Poll Type:")}</dt>
              <dd>{t(policy.pollType)}</dd>
              <dt className="font-semibold">{t("Topics:")}</dt>
              <dd>{policy.topics?.map((topic) => t(topic)).join(", ") || t("None")}</dd>
            </dl>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
