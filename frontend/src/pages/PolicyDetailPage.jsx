import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { policyApi } from "../api/policies";
import { adminApi } from "../api/admin";
import { analyticsApi } from "../api/analytics";
import { plannerApi } from "../api/plannerApi";
import { commentApi } from "../api/comments";
import { translateText } from "../api/translation";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import LanguageSelector from "../components/LanguageSelector";
import { Tabs, TabPane } from "../components/Tabs";
import { MetricCard } from "../components/MetricCard";
import {
  Activity,
  AlertTriangle,
  Bell,
  Users,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
  XCircle,
  Save,
  Copy,
  CheckCircle,
  PenSquare,
} from "lucide-react";
import { formatDate, getErrorMessage, toIsoFromDateInput } from "../lib/format";
import { showToast } from "../lib/toast";
import { ETHIOPIAN_REGIONS } from "../constants/regions";
import { useI18n } from "../i18n/I18nProvider";

const TRANSLATION_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "am", label: "Amharic" },
  { code: "om", label: "Oromo" },
  { code: "ti", label: "Tigrinya" },
];

function ActionButton({
  children,
  icon: Icon,
  onClick,
  variant = "secondary",
  loading = false,
  disabled = false,
}) {
  const classes =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : variant === "danger"
        ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold disabled:opacity-50 ${classes}`}
    >
      {loading ? (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && <Icon className="h-3 w-3" />
      )}
      {children}
    </button>
  );
}

export function PolicyDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [policy, setPolicy] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedTab, setSelectedTab] = useState("info");
  const [stats, setStats] = useState(null);
  const [allComments, setAllComments] = useState([]);
  const [pendingComments, setPendingComments] = useState([]);
  const [reportedComments, setReportedComments] = useState([]);
  const [translatedComments, setTranslatedComments] = useState({});
  const [translatedPolicy, setTranslatedPolicy] = useState(null);
  const [translatingPolicy, setTranslatingPolicy] = useState(false);
  const [policyLanguage, setPolicyLanguage] = useState("en");
  const [appeals, setAppeals] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [allPlanners, setAllPlanners] = useState([]);
  const [loadingPlanners, setLoadingPlanners] = useState(false);
  const [plannerSearch, setPlannerSearch] = useState("");
  const [plannerRegion, setPlannerRegion] = useState("");
  const [plannerLanguage, setPlannerLanguage] = useState("");
  const [plannerPage, setPlannerPage] = useState(1);
  const [plannerTotalPages, setPlannerTotalPages] = useState(1);
  const [plannerTotal, setPlannerTotal] = useState(0);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [selectedAssociate, setSelectedAssociate] = useState(null);
  const [associateMessage, setAssociateMessage] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [modalError, setModalError] = useState("");
  const [overrideComment, setOverrideComment] = useState(null);
  const [overrideSentiment, setOverrideSentiment] = useState("");
  const [reportsModal, setReportsModal] = useState({
    open: false,
    reports: [],
  });
  const [appealModal, setAppealModal] = useState({
    open: false,
    comment: null,
    decision: "",
  });

  const getCommentText = (comment) =>
    comment?.text ||
    comment?.comment?.text ||
    comment?.content ||
    comment?.body ||
    comment?.message ||
    "";

  const setTranslatedComment = (commentId, translatedText) => {
    setTranslatedComments((current) => ({
      ...current,
      [commentId]: translatedText,
    }));
  };

  const revertTranslatedComment = (commentId) => {
    setTranslatedComments((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  };

  const handlePolicyTranslation = async () => {
    if (translatedPolicy) {
      setTranslatedPolicy(null);
      return;
    }

    const title = policy.title || `${(policy.targetRegions || ["Regional"])[0]} ${policy.pollType || ""} ${policy.status || ""} #${(policy._id || id).toString().slice(0, 6)}${policy.topics && policy.topics.length ? ` - ${policy.topics[0]}` : ""}`;
    const description = policy.description || "Regional poll focused on Addis Ababa.";

    setTranslatingPolicy(true);
    setError("");
    try {
      const [translatedTitle, translatedDescription] = await Promise.all([
        translateText({ text: title, targetLang: policyLanguage }),
        translateText({ text: description, targetLang: policyLanguage }),
      ]);

      setTranslatedPolicy({
        title: translatedTitle,
        description: translatedDescription,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to translate policy text"));
    } finally {
      setTranslatingPolicy(false);
    }
  };

  const displayPolicyTitle =
    translatedPolicy?.title ||
    policy?.title ||
    `${(policy?.targetRegions || ["Regional"])[0]} ${policy?.pollType || ""} ${policy?.status || ""} #${(policy?._id || id).toString().slice(0, 6)}${policy?.topics && policy.topics.length ? ` - ${policy.topics[0]}` : ""}`;
  const displayPolicyDescription =
    translatedPolicy?.description ||
    policy?.description ||
    "Regional poll focused on Addis Ababa.";
  const [commentErrors, setCommentErrors] = useState({}); // for per-comment errors
    

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const policyResult = await policyApi.get(id);
      setPolicy(policyResult);
      setIsOwner(
        policyResult.createdBy?._id === user?.id ||
          policyResult.createdBy === user?.id,
      );

      // analytics summary (best-effort)
      try {
        const statsResult = await analyticsApi.summary(id);
        setStats(statsResult);
      } catch (e) {
        setStats(null);
      }

      // comments for this policy
      try {
        const commentsResult = await commentApi.getPolicyComments(id, {
          limit: 1000,
        });
        const commentsList =
          commentsResult?.comments || commentsResult?.data || commentsResult || [];
        setAllComments(commentsList || []);
        setPendingComments(
          (commentsList || []).filter((c) => c.aiStatus === "pending"),
        );
        setReportedComments(
          (commentsList || []).filter((c) => (c.reportCount || 0) > 0),
        );
        setAppeals((commentsList || []).filter((c) => c.appeal));
      } catch (e) {
        setAllComments([]);
        setPendingComments([]);
        setReportedComments([]);
        setAppeals([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load policy"));
    } finally {
      setLoading(false);
    }
  };

  // Redirect draft policies to edit page
  useEffect(() => {
    if (policy && policy.status === "draft") {
      navigate(`/policies/${id}/edit`);
    }
  }, [policy, id, navigate]);

  const runAction = async (
    key,
    action,
    successMsg,
    options = { suppressNotice: false },
  ) => {
    setActionLoading(key);
    setError("");
    if (!options.suppressNotice) setNotice("");
    try {
      await action();
      if (!options.suppressNotice && successMsg) {
        setNotice(successMsg);
        try { showToast('success', successMsg); } catch(e){}
      }
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Action failed"));
    } finally {
      setActionLoading("");
    }
  };

  const handleExtend = async () => {
    const newEnd = window.prompt("New end date (YYYY-MM-DD):", "");
    if (!newEnd) return;
    await runAction(
      "extend",
      () => policyApi.extend(id, toIsoFromDateInput(newEnd, true)),
      "End date extended.",
    );
  };

  const sendInvitation = async () => {
    if (!selectedAssociate || !associateMessage.trim()) return;
    setActionLoading("associateAdd");
    setModalError("");
    setError("");
    setNotice("");
    try {
      await plannerApi.addAssociate(id, {
        plannerEmail: selectedAssociate.email,
        message: associateMessage.trim(),
      });
      setShowAssociateModal(false);
      setSelectedAssociate(null);
      setAssociateMessage("");
      setNotice("Invitation sent successfully.");
      try { showToast('success', 'Invitation sent successfully.'); } catch(e){}
      await loadData();
    } catch (err) {
      setModalError(getErrorMessage(err, "Failed to send invitation"));
    } finally {
      setActionLoading("");
    }
  };

  const viewReports = async (commentId) => {
    setActionLoading(`reports-${commentId}`);
    try {
      const result = await adminApi.getCommentReports(commentId);
      setReportsModal({ open: true, reports: result.reports || [] });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load reports"));
    } finally {
      setActionLoading("");
    }
  };

  const resolveAppeal = async (comment, decision) => {
    const id = comment && (comment._id || comment.commentId || comment.id);
    if (!id) return setError('No comment selected for appeal resolution');
    setActionLoading(`appeal-${id}`);
    try {
      await adminApi.resolveAppeal(id, decision);
      setAppealModal({ open: false, comment: null, decision: "" });
      await loadData(); // refresh all data
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${decision} appeal`));
    } finally {
      setActionLoading("");
    }
  };

  const retryComment = async (commentId) => {
    setActionLoading(`retry-${commentId}`);
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    try {
      await adminApi.retryComment(commentId);
      // Optionally refresh after delay (you can just refresh after 2 seconds)
      setTimeout(() => loadData(), 2000);
    } catch (err) {
      setCommentErrors((prev) => ({
        ...prev,
        [commentId]: getErrorMessage(err),
      }));
    } finally {
      setActionLoading("");
    }
  };
  const renderCommentsList = (comments, actions = []) => (
    <div className="space-y-3">
      {comments.map((c) => {
        const commentId = c._id || c.id;
        const text = c.text || c.comment;
        const userDisplayName = c.userId?.displayName || c.userDisplayName || "Anonymous";
        const createdAt = c.createdAt;
        const sentimentLabel = typeof c.sentiment === "string" ? c.sentiment : c.sentiment?.label || null;
        return (
          <div key={commentId} className="rounded-lg border p-3">
            <p className="text-sm font-semibold">{text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{userDisplayName}</span>
              <span>•</span>
              <span>{formatDate(createdAt)}</span>
              {sentimentLabel && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5">Sentiment: {sentimentLabel}</span>
              )}
              {c.reportCount !== undefined && <span className="text-rose-600">Reports: {c.reportCount}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {actions.map((act) => (
                <ActionButton
                  key={act.label}
                  icon={act.icon}
                  onClick={() => act.onClick(c)}
                  loading={actionLoading === `${act.label}-${commentId}`}
                >
                  {act.label}
                </ActionButton>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
  if (loading) return <LoadingState label="Loading policy details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!policy) return <div>{t("Policy not found")}</div>;

  const mainTabs = [
    { id: "info", label: t("Policy Info") },
    { id: "comments", label: `${t("Comments")} (${allComments.length})` },
    { id: "associates", label: t("Associates") },
  ];

  const commentsSubTabs = [
    { id: "all", label: "All" },
    { id: "ai", label: `AI Needs Review (${pendingComments.length})` },
    { id: "reported", label: `Reported (${reportedComments.length})` },
    { id: "appeals", label: `Appeals (${appeals.length})` },
  ];

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {displayPolicyTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              <strong className="font-medium">{t("Policy Code:")}</strong> {policy.policyCode} • <strong className="font-medium">{t("Read-only view")}</strong>
            </p>
            <p className="mt-2 text-sm text-slate-600">{displayPolicyDescription}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePolicyTranslation}
              disabled={translatingPolicy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {translatingPolicy ? t("Translating...") : t("Translate")}
            </button>
            <select
              value={policyLanguage}
              onChange={(event) => setPolicyLanguage(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none hover:bg-slate-50"
            >
              {TRANSLATION_LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <Link to={`/policies/${id}/analytics`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <svg className="h-4 w-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t("View Analytics")}
            </Link>
            <button onClick={() => runAction('clone', () => policyApi.clone(id), 'Policy cloned.')} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Copy className="h-4 w-4" />
              {t("Clone Policy")}
            </button>
            <Link to="/policies" className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              ← {t("Back")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 md:col-span-2">
          <h3 className="text-lg font-bold mb-3">{t("Description")}</h3>
          <p className="text-sm text-slate-700 mb-4">{displayPolicyDescription}</p>

          <h3 className="text-lg font-bold mb-3">{t("Details")}</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <dt className="font-semibold">{t("Status:")}</dt>
            <dd><StatusBadge status={policy.status} /></dd>

            <dt className="font-semibold">{t("Target Regions:")}</dt>
            <dd>{(policy.targetRegions || []).map((region) => t(region)).join(", ") || t("Addis Ababa")}</dd>

            <dt className="font-semibold">{t("Start Date:")}</dt>
            <dd>{formatDate(policy.startDate)}</dd>

            <dt className="font-semibold">{t("End Date:")}</dt>
            <dd>{formatDate(policy.endDate)}</dd>

            <dt className="font-semibold">{t("Poll Type:")}</dt>
            <dd>{t(policy.pollType || "multipleChoice")}</dd>

            <dt className="font-semibold">{t("Topics:")}</dt>
            <dd>{(policy.topics || []).map((topic) => t(topic)).join(", ") || t("Tourism")}</dd>

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
      {/* notices shown via global toasts */}
      <ErrorAlert message={error} />

      {/* Stats row */}
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Votes"
          value={stats?.totalVotes || 0}
          icon={Activity}
        />
        <MetricCard
          label="Pending AI Review"
          value={pendingComments.length}
          icon={Bell}
        />
        <MetricCard
          label="Reported"
          value={reportedComments.length}
          icon={AlertTriangle}
        />
        <MetricCard label="Appeals" value={appeals.length} icon={Users} />
      </div>

      <Tabs
        tabs={mainTabs}
        activeTab={selectedTab}
        onTabChange={setSelectedTab}
      >
        <TabPane tabId="info">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2 mb-4">
              {policy.status === "published" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "unpublish",
                      () => policyApi.unpublish(id),
                      "Unpublished.",
                    )
                  }
                >
                  Unpublish
                </ActionButton>
              )}
              {policy.status === "active" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction("pause", () => policyApi.pause(id), "Paused.")
                  }
                >
                  Pause
                </ActionButton>
              )}
              {policy.status === "paused" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction("resume", () => policyApi.resume(id), "Resumed.")
                  }
                >
                  Resume
                </ActionButton>
              )}
              {["active", "paused"].includes(policy.status) && (
                <>
                  <ActionButton icon={RefreshCw} onClick={handleExtend}>
                    Extend
                  </ActionButton>
                  <ActionButton
                    icon={RefreshCw}
                    onClick={() =>
                      runAction("close", () => policyApi.close(id), "Closed.")
                    }
                  >
                    Close
                  </ActionButton>
                </>
              )}
              {policy.status !== "archived" && policy.status !== "draft" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "archive",
                      () => policyApi.archive(id),
                      "Archived.",
                    )
                  }
                >
                  Archive
                </ActionButton>
              )}
              {policy.status === "archived" && (
                <ActionButton
                  icon={RefreshCw}
                  onClick={() =>
                    runAction(
                      "restore",
                      () => policyApi.restore(id),
                      "Restored to draft.",
                    )
                  }
                >
                  Restore
                </ActionButton>
              )}
              {["published"].includes(policy.status) && (
                <ActionButton
                  icon={Trash2}
                  variant="danger"
                  onClick={() =>
                    runAction("delete", () => policyApi.delete(id), "Deleted.")
                  }
                >
                  Delete
                </ActionButton>
              )}
              <ActionButton
                icon={Eye}
                onClick={() =>
                  window.open(`/policies/${id}/analytics`, "_blank")
                }
              >
                Full Analytics
              </ActionButton>
              <ActionButton
                icon={Copy}
                onClick={async () => {
                  setActionLoading("clone");
                  try {
                    const result = await policyApi.clone(id);
                    setNotice(
                      `Policy cloned as a new draft. Redirecting to edit...`,
                    );
                    try { showToast('success', 'Policy cloned as a new draft. Redirecting to edit...'); } catch(e){}
                    navigate(`/policies/${result.id}/edit`);
                  } catch (err) {
                    setError(getErrorMessage(err, "Failed to clone policy"));
                  } finally {
                    setActionLoading("");
                  }
                }}
                loading={actionLoading === "clone"}
              >
                Clone
              </ActionButton>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              <dt className="font-semibold">Status:</dt>
              <dd>
                <StatusBadge status={policy.status} />
              </dd>
              <dt className="font-semibold">Target Regions:</dt>
              <dd>{policy.targetRegions?.join(", ") || "None"}</dd>
              <dt className="font-semibold">Start Date:</dt>
              <dd>{formatDate(policy.startDate)}</dd>
              <dt className="font-semibold">End Date:</dt>
              <dd>{formatDate(policy.endDate)}</dd>
              <dt className="font-semibold">Poll Type:</dt>
              <dd>{policy.pollType}</dd>
              <dt className="font-semibold">Topics:</dt>
              <dd>{policy.topics?.join(", ") || "None"}</dd>
              <dt className="font-semibold">Sentiment Counts:</dt>
              <dd>
                Pos: {stats?.sentimentCounts?.positive || 0} | Neg:{" "}
                {stats?.sentimentCounts?.negative || 0} | Neu:{" "}
                {stats?.sentimentCounts?.neutral || 0}
              </dd>
              <dt className="font-semibold">Top Keywords:</dt>
              <dd>
                {stats?.topKeywords
                  ?.slice(0, 5)
                  .map((k) => k.keyword)
                  .join(", ") || "None"}
              </dd>
            </dl>
          </div>
        </TabPane>

        <TabPane tabId="comments">
          <Tabs tabs={commentsSubTabs} defaultTab="all">
            {/* All comments tab: keep as is (list with delete only) */}
            <TabPane tabId="all">
              {renderCommentsList(allComments, [
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: (c) =>
                    runAction(
                      `delete-${c.id}`,
                      () => adminApi.deleteComment(c.id),
                      "Comment deleted.",
                    ),
                },
              ])}
            </TabPane>

            {/* AI Needs Review tab - same as CommentModerationPage's AI tab */}
            <TabPane tabId="ai">
              {pendingComments.map((comment) => {
                const isProcessing =
                  comment.aiStatus === "pending" &&
                  comment.lastAnalyzedAt != null;
                const isLoading =
                  actionLoading === `retry-${comment._id}` ||
                  actionLoading === `override-${comment._id}`;
                const localError = commentErrors[comment._id];
                const sentimentLabel = comment.sentiment?.label;
                const reviewNeeded = comment.reviewFlags?.sentimentReviewNeeded;
                return (
                  <div
                    key={comment._id}
                    className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-sm text-slate-500">
                          Comment by{" "}
                          <span className="font-semibold text-slate-900">
                            {comment.userId?.email || "Unknown"}
                          </span>{" "}
                          • {formatDate(comment.createdAt)}
                          {comment.versionNumber > 1 && (
                            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                              v{comment.versionNumber}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {sentimentLabel && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                              sentimentLabel === "positive"
                                ? "bg-emerald-100 text-emerald-700"
                                : sentimentLabel === "negative"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {sentimentLabel}
                          </span>
                        )}
                        {reviewNeeded && !isProcessing && !isLoading && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                            Low confidence
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />{" "}
                            AI pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-900">{comment.text}</p>
                    </div>
                    {comment.keywords?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-600 mb-1">
                          Keywords:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {comment.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {localError && (
                      <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                        {localError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                      <button
                        onClick={() =>
                          runAction(
                            `approve-${comment._id}`,
                            () =>
                              commentApi.moderate(comment._id, {
                                action: "approve",
                              }),
                            "Comment approved.",
                          )
                        }
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
	                        onClick={() => {
	                          setOverrideComment(comment);
	                          setOverrideSentiment(sentimentLabel || "neutral");
	                        }}
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <PenSquare className="h-3.5 w-3.5" /> Override
                      </button>
                      <button
                        onClick={() => retryComment(comment._id)}
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry AI
                      </button>
                      <button
                        onClick={() =>
                          runAction(
                            `delete-${comment._id}`,
                            () => adminApi.deleteComment(comment._id),
                            "Comment deleted.",
                          )
                        }
                        disabled={isLoading || isProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </TabPane>

            {/* Reported Comments tab */}
            <TabPane tabId="reported">
              {reportedComments.map((comment) => (
                <div
                  key={comment._id}
                  className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">
                        Comment by{" "}
                        <span className="font-semibold text-slate-900">
                          {comment.userId?.email || "Unknown"}
                        </span>{" "}
                        • {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-900">
                      {translatedComments[comment._id] ||
                        getCommentText(comment) ||
                        "Comment unavailable"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <LanguageSelector
                        text={getCommentText(comment)}
                        onTranslated={(translatedText) =>
                          setTranslatedComment(comment._id, translatedText)
                        }
                      />
                      {translatedComments[comment._id] && (
                        <button
                          type="button"
                          onClick={() => revertTranslatedComment(comment._id)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Show original
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={() =>
                        runAction(
                          `restore-${comment._id}`,
                          () =>
                            commentApi.moderate(comment._id, {
                              action: "approve",
                            }),
                          "Comment restored.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve (Restore)
                    </button>
                    <button
                      onClick={() =>
                        runAction(
                          `delete-${comment._id}`,
                          () => adminApi.deleteComment(comment._id),
                          "Comment deleted.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                    <button
                      onClick={() => viewReports(comment._id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" /> View reports
                    </button>
                  </div>
                </div>
              ))}
            </TabPane>

            {/* Appeals tab */}
            <TabPane tabId="appeals">
              {appeals.map((item) => {
                const comment = item.comment || item;
                return (
                  <div
                    key={comment._id}
                    className="rounded-lg border border-slate-200 bg-white p-4 mb-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="text-sm text-slate-500">
                          Comment by{" "}
                          <span className="font-semibold text-slate-900">
                            {comment.userId?.email || "Unknown"}
                          </span>{" "}
                          • {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mb-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-900">{comment.text}</p>
                    </div>
                    {comment.appeal && (
                      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-700">
                          Appeal reason:
                        </p>
                        <p className="text-sm text-blue-800">
                          {comment.appeal.reason}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              setAppealModal({
                                open: true,
                                comment,
                                decision: "approve",
                              })
                            }
                            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                          >
                            Approve appeal
                          </button>
                          <button
                            onClick={() =>
                              setAppealModal({
                                open: true,
                                comment,
                                decision: "reject",
                              })
                            }
                            className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-bold text-white hover:bg-rose-800"
                          >
                            Reject appeal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </TabPane>
          </Tabs>
        </TabPane>

        <TabPane tabId="associates">
          <div className="rounded-lg border bg-white p-5">
            <div className="mb-4 flex justify-between">
              <h3 className="text-lg font-bold">Associates & Invitations</h3>
              {["published", "active", "paused", "closed"].includes(
                policy.status,
              ) && (
                <ActionButton
                  icon={Plus}
                  onClick={() => {
                    setModalError("");
                    setShowAssociateModal(true);
                  }}
                >
                  Invite Associate
                </ActionButton>
              )}
            </div>

            {/* Current Associates */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-slate-700 mb-2">
                Current
              </h4>
              {associates.filter(
                (a) =>
                  a.displayStatus === "pending" ||
                  a.displayStatus === "accepted",
              ).length === 0 ? (
                <p className="text-slate-500">
                  No active associates or pending invitations.
                </p>
              ) : (
                <div className="divide-y">
                  {associates
                    .filter(
                      (a) =>
                        a.displayStatus === "pending" ||
                        a.displayStatus === "accepted",
                    )
                    .map((assoc) => {
                      const isPending = assoc.displayStatus === "pending";
                      const isAccepted = assoc.displayStatus === "accepted";
                      const invitationMessage = assoc.metadata?.notes;
                      return (
                        <div
                          key={assoc._id}
                          className="py-4 flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold">
                              {assoc.plannerId?.email}
                              {isPending && (
                                <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                  Pending
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              Message: {invitationMessage || "No message"}
                            </p>
                            {isPending && assoc.daysRemaining !== null && (
                              <p className="text-xs text-amber-600">
                                Expires in {assoc.daysRemaining} days
                              </p>
                            )}
                            {isAccepted && (
                              <p className="text-xs text-slate-500">
                                Accepted: {formatDate(assoc.acceptedAt)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {(isPending || isAccepted) && (
                              <ActionButton
                                icon={Trash2}
                                variant="danger"
                                onClick={() =>
                                  runAction(
                                    `revoke-${assoc._id}`,
                                    () =>
                                      plannerApi.revokeAssociate(id, assoc._id),
                                    isPending
                                      ? "Invitation cancelled."
                                      : "Associate revoked.",
                                  )
                                }
                              >
                                {isPending ? "Cancel Invitation" : "Revoke"}
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

          </div>
        </TabPane>
      </Tabs>
      {/* Override Sentiment Modal */}
      {overrideComment && (
        <Modal
          title="Override Sentiment"
          onClose={() => setOverrideComment(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Original: {overrideComment.text}
            </p>
            <div>
              <label className="block text-sm font-semibold">Sentiment</label>
              <select
                value={overrideSentiment}
                onChange={(e) => setOverrideSentiment(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="">Select sentiment</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <ActionButton
              icon={Save}
              onClick={() => {
                const sentimentLabel =
                  overrideSentiment === "positive"
                    ? "positive"
                    : overrideSentiment === "negative"
                      ? "negative"
                      : "neutral";
                runAction(
                  `override-${overrideComment._id}`,
                  () =>
                    adminApi.updateComment(overrideComment._id, {
                      sentiment: { label: sentimentLabel, confidence: 1 },
                    }),
                  "Sentiment overridden.",
                );
                setOverrideComment(null);
                setOverrideSentiment("");
              }}
              disabled={!overrideSentiment}
            >
              Save Override
            </ActionButton>
          </div>
        </Modal>
      )}
      {/* Invite Associate Modal */}
      {showAssociateModal && (
        <Modal
          title="Invite Associate"
          onClose={
            actionLoading === "associateAdd"
              ? undefined
              : () => {
                  setShowAssociateModal(false);
                  setSelectedAssociate(null);
                  setAssociateMessage("");
                }
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Search by email"
                value={plannerSearch}
                onChange={(e) => setPlannerSearch(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={plannerRegion}
                onChange={(e) => setPlannerRegion(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All regions</option>
                {ETHIOPIAN_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={plannerLanguage}
                onChange={(e) => setPlannerLanguage(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All languages</option>
                <option value="am">Amharic</option>
                <option value="om">Oromo</option>
                <option value="ti">Tigrinya</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {loadingPlanners ? (
                <p className="p-4 text-center text-slate-500">
                  Loading planners...
                </p>
              ) : allPlanners.length === 0 ? (
                <p className="p-4 text-center text-slate-500">
                  No planners found.
                </p>
              ) : (
                allPlanners.map((planner) => {
                  const isAlreadyAssociate = associates.some(
                    (a) => a.plannerId?._id === planner._id && !a.revokedAt,
                  );
                  if (isAlreadyAssociate) return null;
                  return (
                    <div
                      key={planner._id}
                      className={`p-3 flex justify-between items-center hover:bg-slate-50 cursor-pointer ${selectedAssociate?._id === planner._id ? "bg-teal-50 border-teal-200" : ""}`}
                      onClick={() => {
                        setSelectedAssociate(planner);
                        setAssociateMessage("");
                      }}
                    >
                      <div>
                        <p className="font-semibold text-sm">{planner.email}</p>
                        <p className="text-xs text-slate-500">
                          {planner.languagesSpoken?.join(", ") ||
                            "No languages"}{" "}
                          • {planner.region || "No region"}
                        </p>
                      </div>
                      {selectedAssociate?._id === planner._id && (
                        <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-1 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {!loadingPlanners && allPlanners.length > 0 && (
              <div className="flex justify-between items-center mt-2">
                <button
                  disabled={plannerPage <= 1}
                  onClick={() => setPlannerPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-xs"
                >
                  Previous
                </button>
                <span className="text-xs">
                  Page {plannerPage} of {plannerTotalPages} ({plannerTotal}{" "}
                  total)
                </span>
                <button
                  disabled={plannerPage >= plannerTotalPages}
                  onClick={() => setPlannerPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-xs"
                >
                  Next
                </button>
              </div>
            )}
            {selectedAssociate && (
              <div className="space-y-3 border-t pt-3">
                <label className="block text-sm font-semibold">
                  Invitation message for{" "}
                  <span className="text-teal-700">
                    {selectedAssociate.email}
                  </span>
                </label>
                <textarea
                  value={associateMessage}
                  onChange={(e) => setAssociateMessage(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Describe how this associate should help analyze the policy results."
                />
                {modalError && <ErrorAlert message={modalError} />}
                <ActionButton
                  onClick={sendInvitation}
                  disabled={
                    !associateMessage.trim() ||
                    actionLoading === "associateAdd"
                  }
                  loading={actionLoading === "associateAdd"}
                >
                  Send Invitation
                </ActionButton>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reports modal */}
      {reportsModal.open && (
        <Modal
          title="Comment Reports"
          onClose={() => setReportsModal({ open: false, reports: [] })}
        >
          {reportsModal.reports.length === 0 ? (
            <p className="text-sm text-slate-600">No reports found.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reportsModal.reports.map((report, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs font-semibold text-slate-600">
                    Reported by: {report.reportedBy?.email || "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Reason: {report.reason}
                  </p>
                  {report.details && (
                    <p className="text-xs text-slate-500">
                      Details: {report.details}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Status: {report.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created: {formatDate(report.createdAt)}
                  </p>
                  {report.resolvedAt && (
                    <p className="text-xs text-slate-500">
                      Resolved: {formatDate(report.resolvedAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Appeal resolution modal */}
      {appealModal.open && appealModal.comment && (
        <Modal
          title="Resolve Appeal"
          onClose={() =>
            setAppealModal({ open: false, comment: null, decision: "" })
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">
                Comment text:
              </p>
              <p className="text-sm text-slate-900">
                {appealModal.comment.text}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-900">
                Appeal reason:
              </p>
              <p className="text-sm text-blue-800">
                {appealModal.comment.appeal?.reason}
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() =>
                  setAppealModal({ open: false, comment: null, decision: "" })
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveAppeal(appealModal.comment, "approve")}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Overturn (approve comment)
              </button>
              <button
                onClick={() => resolveAppeal(appealModal.comment, "reject")}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
              >
                Reject appeal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
