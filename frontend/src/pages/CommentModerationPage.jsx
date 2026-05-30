import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Trash2,
  History,
  Eye,
  PenSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { commentApi } from "../api/comments";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import LanguageSelector from "../components/LanguageSelector";
import { getErrorMessage, formatDate } from "../lib/format";

const SENTIMENT_COLORS = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-rose-100 text-rose-700",
  neutral: "bg-slate-100 text-slate-700",
};

export function CommentModerationPage() {
  const [aiComments, setAiComments] = useState([]);
  const [reportedComments, setReportedComments] = useState([]);
  const [appealComments, setAppealComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("ai");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [actionType, setActionType] = useState(null); // "approve", "delete"

  const [overrideModal, setOverrideModal] = useState({
    open: false,
    comment: null,
    sentiment: "neutral",
    keywords: "",
  });

  const [historyModal, setHistoryModal] = useState({
    open: false,
    versions: [],
  });

  const [appealModal, setAppealModal] = useState({
    open: false,
    comment: null,
    decision: "",
  });

  const [reportsModal, setReportsModal] = useState({
    open: false,
    reports: [],
  });

  const [translatedComments, setTranslatedComments] = useState({});

  // Local error per comment (for retry failures)
  const [commentErrors, setCommentErrors] = useState({});

  const loadAllData = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const [aiRes, reportedRes, appealsRes] = await Promise.all([
        adminApi.getAIReviewComments(),
        adminApi.getReportedComments(),
        adminApi.getPendingAppeals(),
      ]);
      setAiComments(aiRes.comments || []);
      setReportedComments(reportedRes.comments || []);
      setAppealComments(appealsRes.appeals || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load comments"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Reload only the AI list (used after retry)
  const reloadAIList = async () => {
    try {
      const aiRes = await adminApi.getAIReviewComments();
      setAiComments(aiRes.comments || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to refresh AI comments"));
    }
  };

  // Moderate comment (approve/delete)
  const moderateComment = async (commentId, action) => {
    const id = commentId || (selectedComment && (selectedComment._id || selectedComment.commentId || selectedComment.id));
    if (!id) return setError('No comment selected for moderation');
    setActionLoading((prev) => ({ ...prev, [id]: action }));
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    setSuccessMessage("");
    try {
      await adminApi.moderateComment(id, { action });
      setModalOpen(false);
      setSelectedComment(null);
      void loadAllData({ silent: true });
      setSuccessMessage(`Comment ${action}d.`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      const msg = getErrorMessage(err, `Failed to ${action} comment`);
      setCommentErrors((prev) => ({ ...prev, [id]: msg }));
    } finally {
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }
  };

  // Override sentiment & keywords
  const overrideComment = async () => {
    const { comment, sentiment, keywords } = overrideModal;
    if (!comment) return;
    setActionLoading((prev) => ({ ...prev, [comment._id]: "override" }));
    setCommentErrors((prev) => ({ ...prev, [comment._id]: null }));
    setSuccessMessage("");
    try {
      await adminApi.moderateComment(comment._id, {
        action: "approve",
        sentiment: sentiment
          ? { label: sentiment, confidence: 1.0 }
          : undefined,
        keywords: keywords
          ? keywords.split(",").map((k) => k.trim())
          : undefined,
      });
      setOverrideModal({
        open: false,
        comment: null,
        sentiment: "neutral",
        keywords: "",
      });
      await reloadAIList();
      setSuccessMessage("Comment overridden.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to override comment");
      setCommentErrors((prev) => ({ ...prev, [comment._id]: msg }));
    } finally {
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[comment._id];
        return newState;
      });
    }
  };

  // Retry AI (single retry)
  const retryComment = async (commentId) => {
    setActionLoading((prev) => ({ ...prev, [commentId]: "retry" }));
    setCommentErrors((prev) => ({ ...prev, [commentId]: null }));
    setSuccessMessage("");
    try {
      await adminApi.retryComment(commentId);
      // Wait a short time for AI to process? The worker runs asynchronously.
      // We'll refresh the AI list after a delay to give the worker time.
      setTimeout(async () => {
        await reloadAIList();
        // After refresh, check if the comment now has high confidence (reviewFlags.sentimentReviewNeeded === false)
        const updatedComment = aiComments.find((c) => c._id === commentId);
        if (
          updatedComment &&
          !updatedComment.reviewFlags?.sentimentReviewNeeded
        ) {
          setSuccessMessage(
            "AI analysis successful – comment now has high confidence.",
          );
          setTimeout(() => setSuccessMessage(""), 4000);
        }
      }, 2000);
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to retry AI analysis");
      setCommentErrors((prev) => ({ ...prev, [commentId]: msg }));
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[commentId];
        return newState;
      });
    }
  };

  const deleteComment = (comment) => {
    setSelectedComment(comment);
    setActionType("delete");
    setModalOpen(true);
  };

  const rejectComment = (comment) => {
    setSelectedComment(comment);
    setActionType("reject");
    setModalOpen(true);
  };

  const viewHistory = async (commentId) => {
    setActionLoading((prev) => ({ ...prev, [`history-${commentId}`]: true }));
    try {
      const versions = await commentApi.getVersions(commentId);
      setHistoryModal({ open: true, versions: versions || [] });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load comment history"));
    } finally {
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[`history-${commentId}`];
        return newState;
      });
    }
  };

  const viewReports = async (commentId) => {
    setActionLoading((prev) => ({ ...prev, [`reports-${commentId}`]: true }));
    try {
      const result = await adminApi.getCommentReports(commentId);
      setReportsModal({ open: true, reports: result.reports || [] });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load reports"));
    } finally {
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[`reports-${commentId}`];
        return newState;
      });
    }
  };

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

  const resolveAppeal = async (comment, decision) => {
    const id = comment && (comment._id || comment.commentId || comment.id);
    if (!id) return setError('No comment selected for appeal resolution');
    setActionLoading((prev) => ({ ...prev, [`appeal-${id}`]: decision }));
    try {
      await adminApi.resolveAppeal(id, decision);
      setAppealComments((prev) => prev.filter((item) => (item._id || item.commentId || item.id) !== id));
      setAppealModal({ open: false, comment: null, decision: "" });
      void loadAllData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${decision} appeal`));
    } finally {
      setActionLoading((prev) => {
        const newState = { ...prev };
        delete newState[`appeal-${id}`];
        return newState;
      });
    }
  };

  const renderCommentCard = (comment, type) => {
    const isAI = type === "ai";
    const isReported = type === "reported";
    const isAppeal = type === "appeal";

    const isLoading =
      actionLoading[comment._id] === "retry" ||
      actionLoading[comment._id] === "override";
    const isProcessing =
      isLoading ||
      (comment.aiStatus === "pending" && comment.lastAnalyzedAt != null);
    const localError = commentErrors[comment._id];

    const sentimentLabel = comment.sentiment?.label;
    const reviewNeeded = comment.reviewFlags?.sentimentReviewNeeded;
    const isHighConfidence = !reviewNeeded && comment.aiStatus === "processed";

    // Determine if buttons should be disabled
    const disableActions = isLoading || isProcessing;

    return (
      <div
        key={comment._id}
        className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-600">
              Policy:{" "}
              <span className="text-slate-900 font-bold">
                {comment.policyId?.title || "Deleted"}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Comment by {comment.userId?.email || "Unknown"} •{" "}
              {formatDate(comment.createdAt)}
              {comment.versionNumber > 1 && (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                  v{comment.versionNumber}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1">
            {!isReported && sentimentLabel && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${SENTIMENT_COLORS[sentimentLabel] || "bg-slate-100 text-slate-700"}`}
              >
                {sentimentLabel}
              </span>
            )}
            {isAI && reviewNeeded && !isProcessing && !isHighConfidence && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                Low confidence
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                AI pending
              </span>
            )}
          </div>
        </div>

        <div className="mb-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-900">
            {translatedComments[comment._id] || getCommentText(comment) || "Comment unavailable"}
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

        {!isReported && comment.keywords?.length > 0 && (
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

        {isAppeal && comment.appeal && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700">
              Appeal reason:
            </p>
            <p className="text-sm text-blue-800">{comment.appeal.reason}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() =>
                  setAppealModal({ open: true, comment, decision: "approve" })
                }
                className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
              >
                Approve appeal
              </button>
              <button
                onClick={() =>
                  setAppealModal({ open: true, comment, decision: "reject" })
                }
                className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-bold text-white hover:bg-rose-800"
              >
                Reject appeal
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
          {isAI && (
            <>
              <button
                onClick={() => {
                  setSelectedComment(comment);
                  setActionType("approve");
                  setModalOpen(true);
                }}
                disabled={disableActions}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                onClick={() => {
                  setOverrideModal({
                    open: true,
                    comment,
                    sentiment: sentimentLabel || "neutral",
                    keywords: (comment.keywords || []).join(", "),
                  });
                }}
                disabled={disableActions}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <PenSquare className="h-3.5 w-3.5" />
                Override
              </button>
              <button
                onClick={() => retryComment(comment._id)}
                disabled={disableActions}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry AI
              </button>
              <button
                onClick={() => deleteComment(comment)}
                disabled={disableActions}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}

          {isReported && (
            <>
              <button
                onClick={() => {
                  setSelectedComment(comment);
                  setActionType("approve");
                  setModalOpen(true);
                }}
                disabled={actionLoading[comment._id]}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve (restore)
              </button>
              <button
                onClick={() => rejectComment(comment)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                onClick={() => viewReports(comment._id)}
                disabled={actionLoading[`reports-${comment._id}`]}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Eye className="h-3.5 w-3.5" />
                View reports
              </button>
            </>
          )}

          {/* History button – only for appeals */}
          {isAppeal && (
            <button
              onClick={() => viewHistory(comment._id)}
              disabled={actionLoading[`history-${comment._id}`]}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <LoadingState label="Loading comments" />;

  const currentData =
    activeTab === "ai"
      ? aiComments
      : activeTab === "reported"
        ? reportedComments
        : appealComments;

  const noDataMessage =
    activeTab === "ai"
      ? "No comments need AI review."
      : activeTab === "reported"
        ? "No reported comments."
        : "No pending appeals.";

  return (
    <div>
      <PageHeader
        title="Comment Moderation"
        description="Review low‑confidence AI comments, reported comments, and pending appeals."
      />

      <div className="space-y-5">
        <ErrorAlert message={error} />
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("ai")}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
              activeTab === "ai"
                ? "border-b-2 border-teal-700 text-teal-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            AI Needs Review ({aiComments.length})
          </button>
          <button
            onClick={() => setActiveTab("reported")}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
              activeTab === "reported"
                ? "border-b-2 border-teal-700 text-teal-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Reported ({reportedComments.length})
          </button>
          <button
            onClick={() => setActiveTab("appeal")}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
              activeTab === "appeal"
                ? "border-b-2 border-teal-700 text-teal-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Appeals Pending ({appealComments.length})
          </button>
          <button
            onClick={() => loadAllData({ silent: true })}
            disabled={loading || refreshing}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {currentData.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900">{noDataMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentData.map((item) => {
              const comment = item.comment || {
                ...item,
                _id: item._id || item.commentId,
                policyId:
                  item.policyId ||
                  (item.policy ? { title: item.policy } : undefined),
                userId: item.userId || item.appellant,
              };
              return renderCommentCard(comment, activeTab);
            })}
          </div>
        )}
      </div>

      {/* Confirmation modal for approve/delete */}
      {modalOpen && selectedComment && (
        <Modal
          title={`${actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Delete"} Comment`}
          onClose={() => setModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-900">
                "{getCommentText(selectedComment) || "Comment unavailable"}"
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {actionType === "approve"
                ? "Approve this comment? It will become visible and included in analytics. Any pending reports or appeals will be resolved."
                  : actionType === "reject"
                    ? "Reject this comment? It will remain hidden and the reports will be treated as invalid."
                    : "Delete this comment? It will be permanently hidden."}
            </p>
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => moderateComment(selectedComment._id, actionType)}
                disabled={actionLoading[selectedComment._id]}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                  actionType === "approve"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-rose-700 hover:bg-rose-800"
                }`}
              >
                {actionLoading[selectedComment._id]
                  ? "Processing..."
                  : actionType === "approve"
                    ? "Approve"
                    : actionType === "reject"
                      ? "Reject"
                      : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Override modal */}
      {overrideModal.open && overrideModal.comment && (
        <Modal
          title="Override Sentiment & Keywords"
          onClose={() =>
            setOverrideModal({
              open: false,
              comment: null,
              sentiment: "neutral",
              keywords: "",
            })
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Sentiment
              </label>
              <select
                value={overrideModal.sentiment}
                onChange={(e) =>
                  setOverrideModal({
                    ...overrideModal,
                    sentiment: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              >
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Keywords (comma separated)
              </label>
              <input
                type="text"
                value={overrideModal.keywords}
                onChange={(e) =>
                  setOverrideModal({
                    ...overrideModal,
                    keywords: e.target.value,
                  })
                }
                placeholder="e.g. education, funding, schools"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() =>
                  setOverrideModal({
                    open: false,
                    comment: null,
                    sentiment: "neutral",
                    keywords: "",
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={overrideComment}
                disabled={actionLoading[overrideModal.comment._id]}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                Save Override
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* History modal (versions) */}
      {historyModal.open && (
        <Modal
          title="Comment Version History"
          onClose={() => setHistoryModal({ open: false, versions: [] })}
        >
          {historyModal.versions.length === 0 ? (
            <p className="text-sm text-slate-600">
              No previous versions found.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyModal.versions.map((version, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="text-xs text-slate-500 mb-1">
                    Version {version.versionNumber} • Created{" "}
                    {formatDate(version.createdAt)}
                  </p>
                  <p className="text-sm text-slate-900">{version.text}</p>
                  {version.sentiment?.label && (
                    <p className="text-xs text-slate-600 mt-1">
                      Sentiment: {version.sentiment.label} (
                      {(version.sentiment.confidence * 100).toFixed(0)}%)
                    </p>
                  )}
                  {version.keywords?.length > 0 && (
                    <p className="text-xs text-slate-600">
                      Keywords: {version.keywords.join(", ")}
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
                {translatedComments[appealModal.comment._id] ||
                  getCommentText(appealModal.comment) ||
                  "Comment unavailable"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <LanguageSelector
                  text={getCommentText(appealModal.comment)}
                  onTranslated={(translatedText) =>
                    setTranslatedComment(appealModal.comment._id, translatedText)
                  }
                />
                {translatedComments[appealModal.comment._id] && (
                  <button
                    type="button"
                    onClick={() =>
                      revertTranslatedComment(appealModal.comment._id)
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Show original
                  </button>
                )}
              </div>
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

      {/* Reports list modal */}
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
    </div>
  );
}
