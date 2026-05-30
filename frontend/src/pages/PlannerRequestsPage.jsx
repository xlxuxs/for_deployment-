import {
  CheckCircle,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { plannerApi } from "../api/planners";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/I18nProvider";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";

function FieldPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TimelineItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      />
    </label>
  );
}

export function PlannerRequestsPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [activeTab, setActiveTab] = useState("requests");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [resolvingAppeal, setResolvingAppeal] = useState(null);
  const [appealDecision, setAppealDecision] = useState("");
  const [reason, setReason] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  async function loadRequests({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const [result, historyResult, appealResult] = await Promise.all([
        plannerApi.listPendingRequests(),
        plannerApi.listRequestHistory(),
        plannerApi.listDeactivationAppeals({ status: "pending" }),
      ]);
      setRequests(Array.isArray(result) ? result : []);
      setRequestHistory(Array.isArray(historyResult) ? historyResult : []);
      setAppeals(Array.isArray(appealResult) ? appealResult : []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planner requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approve(request) {
    setActionLoading(request._id);
    setError("");
    try {
      await plannerApi.approveRequest(request._id);
      setRequests((prev) => prev.filter((item) => item._id !== request._id));
      showToast("success", "Planner request approved.");
      await loadRequests({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to approve request"));
    } finally {
      setActionLoading("");
    }
  }

  async function reject() {
    if (!rejecting) return;
    if (reason.trim().length < 10) {
      setError("Rejection reason must be at least 10 characters.");
      return;
    }
    setActionLoading(rejecting._id);
    setError("");
    try {
      await plannerApi.rejectRequest(rejecting._id, reason.trim());
      setRequests((prev) => prev.filter((item) => item._id !== rejecting._id));
      showToast("success", "Planner request rejected.");
      setRejecting(null);
      setReason("");
      await loadRequests({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reject request"));
    } finally {
      setActionLoading("");
    }
  }

  async function resolveAppeal() {
    if (!resolvingAppeal || !appealDecision) return;
    setActionLoading(resolvingAppeal._id);
    setError("");
    try {
      await plannerApi.resolveDeactivationAppeal(resolvingAppeal._id, {
        decision: appealDecision,
        adminNote: reason.trim(),
      });
      setAppeals((prev) => prev.filter((item) => item._id !== resolvingAppeal._id));
      showToast(
        "success",
        appealDecision === "approve"
          ? "Planner appeal approved and account reactivated."
          : "Planner appeal rejected.",
      );
      setResolvingAppeal(null);
      setAppealDecision("");
      setReason("");
      await loadRequests({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to resolve appeal"));
    } finally {
      setActionLoading("");
    }
  }

  function translateValue(value, fallback = "Not provided") {
    if (!value) {
      return t(fallback);
    }
    return t(String(value));
  }

  function formatLanguages(value) {
    if (!Array.isArray(value) || !value.length) {
      return t("Not provided");
    }
    return value.map((item) => t(String(item))).join(", ");
  }

  function getApplicantName(request) {
    return request.fullName || request.userId?.email || request.email || t("Unknown applicant");
  }

  function getApplicantEmail(request) {
    return request.userId?.email || request.email || t("Not provided");
  }

  function getRegion(request) {
    return request.region || request.userId?.region || t("No region");
  }

  function matchesSearch(request, query, includeReviewer = false) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    const searchable = [
      request.fullName,
      request.email,
      request.userId?.email,
      request.region,
      request.userId?.region,
      request.reason,
      request.occupation,
      request.education,
      request.ageRange,
      request.gender,
      request.preferredLanguage,
      Array.isArray(request.languagesSpoken) ? request.languagesSpoken.join(" ") : "",
      includeReviewer ? request.reviewedBy?.email : "",
      includeReviewer ? request.rejectionReason : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  }

  const filteredRequests = requests.filter((request) => matchesSearch(request, requestSearch));
  const filteredHistory = requestHistory.filter((request) => matchesSearch(request, historySearch, true));

  if (loading) return <LoadingState label="Loading planner requests" />;

  const requestCounts = {
    pendingRequests: requests.length,
    reviewedRequests: requestHistory.length,
    pendingAppeals: appeals.length,
  };

  return (
    <div>
      <PageHeader
        title="Planner Requests"
        description="Review citizen requests for planner access and planner deactivation appeals."
      />
      <ErrorAlert message={error} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t("Pending planner requests")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black text-slate-950">{requestCounts.pendingRequests}</p>
              <p className="text-sm text-slate-500">{t("Submitted request")}</p>
            </div>
            <ShieldCheck className="h-9 w-9 text-emerald-600" />
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-amber-100 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_100%)] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t("Pending deactivation appeals")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black text-slate-950">{requestCounts.pendingAppeals}</p>
              <p className="text-sm text-slate-500">{t("Pending appeal")}</p>
            </div>
            <TimerReset className="h-9 w-9 text-amber-600" />
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{t("Reviewed request history")}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black text-slate-950">{requestCounts.reviewedRequests}</p>
              <p className="text-sm text-slate-500">{t("Reviewed request")}</p>
            </div>
            <RefreshCw className="h-9 w-9 text-sky-600" />
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("requests")}
          className={`rounded-t-2xl px-4 py-2.5 text-sm font-bold ${
            activeTab === "requests"
              ? "border-b-2 border-teal-700 text-teal-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t("Planner Requests")} ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`rounded-t-2xl px-4 py-2.5 text-sm font-bold ${
            activeTab === "history"
              ? "border-b-2 border-teal-700 text-teal-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t("Request History")} ({requestHistory.length})
        </button>
        <button
          onClick={() => setActiveTab("appeals")}
          className={`rounded-t-2xl px-4 py-2.5 text-sm font-bold ${
            activeTab === "appeals"
              ? "border-b-2 border-teal-700 text-teal-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t("Deactivation Appeals")} ({appeals.length})
        </button>
      </div>

      {activeTab === "requests" ? (
        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">{t("Search pending requests")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("Search by applicant, email, region, or reason...")}</p>
            <div className="mt-3">
              <SearchBox
                value={requestSearch}
                onChange={setRequestSearch}
                placeholder={t("Search by applicant, email, region, or reason...")}
              />
            </div>
          </div>

          {requests.length ? (
            filteredRequests.length ? (
              <section className="space-y-4">
                {filteredRequests.map((request) => (
                  <article key={request._id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)] px-5 py-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-black text-slate-950">{getApplicantName(request)}</p>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{t("Pending")}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-600">{getApplicantEmail(request)}</p>
                          <p className="mt-1 text-sm text-slate-500">{t(getRegion(request))}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {t("Submitted")} {formatDate(request.createdAt)}
                          </span>
                          <button
                            type="button"
                            disabled={actionLoading === request._id}
                            onClick={() => approve(request)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {t("Approve")}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === request._id}
                            onClick={() => setRejecting(request)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            {t("Reject")}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
                      <div className="space-y-4">
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Request summary")}</p>
                          <p className="mt-3 text-sm leading-7 text-slate-700">{request.reason}</p>
                        </div>

                        {request.proofFile ? (
                          <a
                            href={request.proofFile}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <FileText className="h-4 w-4 text-teal-700" />
                            {t("Open support file")}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Demographics")}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <FieldPill label={t("Age range")} value={translateValue(request.ageRange)} />
                            <FieldPill label={t("Gender")} value={translateValue(request.gender)} />
                            <FieldPill label={t("Occupation")} value={translateValue(request.occupation)} />
                            <FieldPill label={t("Education")} value={translateValue(request.education)} />
                            <FieldPill label={t("Preferred language")} value={translateValue(request.preferredLanguage)} />
                            <FieldPill label={t("Languages spoken")} value={formatLanguages(request.languagesSpoken)} />
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Applicant profile")}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <FieldPill label={t("Full name")} value={getApplicantName(request)} />
                            <FieldPill label={t("Email")} value={getApplicantEmail(request)} />
                            <FieldPill label={t("Region")} value={t(getRegion(request))} />
                            <FieldPill label={t("Status")} value={t("Pending")} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <EmptyState title="No matching pending requests" description="Try another search term or clear the filter." />
            )
          ) : (
            <EmptyState title="No pending planner requests" description="New citizen requests will appear here." />
          )}
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">{t("Search request history")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("Search by applicant, email, reviewer, or region...")}</p>
            <div className="mt-3">
              <SearchBox
                value={historySearch}
                onChange={setHistorySearch}
                placeholder={t("Search by applicant, email, reviewer, or region...")}
              />
            </div>
          </div>

          {requestHistory.length ? (
            filteredHistory.length ? (
              <section className="space-y-4">
                {filteredHistory.map((request) => {
                  const isApproved = request.status === "approved";

                  return (
                    <article key={request._id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                      <div className="border-b border-slate-100 px-5 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-black text-slate-950">{getApplicantName(request)}</p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                  isApproved ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {isApproved ? t("Approved") : t("Rejected")}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-600">{getApplicantEmail(request)}</p>
                            <p className="mt-1 text-sm text-slate-500">{t(getRegion(request))}</p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                            <TimelineItem label={t("Submitted")} value={formatDate(request.createdAt)} />
                            <TimelineItem label={t("Reviewed")} value={formatDate(request.reviewedAt)} />
                            <TimelineItem label={t("Reviewer")} value={request.reviewedBy?.email || t("Unknown admin")} />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
                        <div className="space-y-4">
                          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Request summary")}</p>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{request.reason}</p>
                          </div>

                          {request.rejectionReason ? (
                            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                              <span className="font-bold">{t("Rejection reason:")}</span> {request.rejectionReason}
                            </div>
                          ) : null}

                          {request.proofFile ? (
                            <a
                              href={request.proofFile}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-4 w-4 text-teal-700" />
                              {t("Open support file")}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Demographics")}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <FieldPill label={t("Age range")} value={translateValue(request.ageRange)} />
                              <FieldPill label={t("Gender")} value={translateValue(request.gender)} />
                              <FieldPill label={t("Occupation")} value={translateValue(request.occupation)} />
                              <FieldPill label={t("Education")} value={translateValue(request.education)} />
                              <FieldPill label={t("Preferred language")} value={translateValue(request.preferredLanguage)} />
                              <FieldPill label={t("Languages spoken")} value={formatLanguages(request.languagesSpoken)} />
                            </div>
                          </div>

                          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("Review timeline")}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <FieldPill label={t("Region")} value={t(getRegion(request))} />
                              <FieldPill label={t("Status")} value={isApproved ? t("Approved") : t("Rejected")} />
                              <FieldPill label={t("Reviewer")} value={request.reviewedBy?.email || t("Unknown admin")} />
                              <FieldPill label={t("Email")} value={getApplicantEmail(request)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <EmptyState title="No matching request history" description="Try another search term or review a different applicant." />
            )
          ) : (
            <EmptyState title="No reviewed planner requests" description="Approved and rejected planner requests will appear here." />
          )}
        </div>
      ) : null}

      {activeTab === "appeals" ? (
        appeals.length ? (
          <section className="space-y-3">
            {appeals.map((appeal) => (
              <article key={appeal._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-slate-950">
                        {appeal.plannerId?.email || t("Unknown")}
                      </p>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{t("Pending appeal")}</span>
                    </div>
                    <p className="text-sm text-slate-600">{t(appeal.plannerId?.region || "No region")}</p>
                    <p className="max-w-3xl text-sm leading-6 text-slate-700">{appeal.reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {t("Submitted")} {formatDate(appeal.createdAt)}
                    </span>
                    <button
                      type="button"
                      disabled={actionLoading === appeal._id}
                      onClick={() => {
                        setResolvingAppeal(appeal);
                        setAppealDecision("approve");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {t("Approve")}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === appeal._id}
                      onClick={() => {
                        setResolvingAppeal(appeal);
                        setAppealDecision("reject");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      {t("Reject")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <EmptyState title="No pending deactivation appeals" description="Appeals from deactivated planners will appear here." />
        )
      ) : null}

      {rejecting ? (
        <Modal title="Reject planner request" onClose={() => setRejecting(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t("Provide a reason for rejecting")} {rejecting.userId?.email || t("this applicant")}.
            </p>
            <textarea
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setRejecting(null)}>
                {t("Cancel")}
              </button>
              <button type="button" disabled={Boolean(actionLoading)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50" onClick={reject}>
                {t("Reject")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {resolvingAppeal ? (
        <Modal title="Resolve planner appeal" onClose={() => setResolvingAppeal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {appealDecision === "approve"
                ? `Approve this appeal and reactivate ${resolvingAppeal.plannerId?.email || "the planner"}?`
                : `Reject the appeal from ${resolvingAppeal.plannerId?.email || "this planner"}?`}
            </p>
            <textarea
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("Admin note (optional)")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setResolvingAppeal(null)}>
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={Boolean(actionLoading)}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${
                  appealDecision === "approve"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-rose-700 hover:bg-rose-800"
                } disabled:opacity-50`}
                onClick={resolveAppeal}
              >
                {appealDecision === "approve" ? t("Approve appeal") : t("Reject appeal")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
