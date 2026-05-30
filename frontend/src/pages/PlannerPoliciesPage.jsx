import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Copy,
  Edit,
  History,
  Pause,
  Play,
  Power,
  RefreshCw,
  Archive,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { policyApi } from "../api/policies";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { showToast } from "../lib/toast";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, getErrorMessage, toIsoFromDateInput } from "../lib/format";
import { adminApi } from "../api/admin";

function Button({ children, icon: Icon, variant = "secondary", ...props }) {
  const classes =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : variant === "danger"
        ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${classes}`}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function PlannerPoliciesPage() {
  const { userId } = useParams();
  const [planner, setPlanner] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyPolicy, setHistoryPolicy] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);

  useEffect(() => {
    async function fetchPlannerAndPolicies() {
      setLoading(true);
      setError("");
      try {
        // Fetch planner details
        const plannersRes = await adminApi.listPlanners({
          page: 1,
          limit: 100,
        });
        const foundPlanner = plannersRes.planners.find((p) => p._id === userId);
        if (!foundPlanner) throw new Error("Planner not found");
        setPlanner(foundPlanner);

        // Fetch policies owned by this planner using owner=userId (admin only)
        const policiesRes = await policyApi.list({ owner: userId, limit: 100 });
        setPolicies(policiesRes.policies || []);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load planner policies"));
      } finally {
        setLoading(false);
      }
    }
    fetchPlannerAndPolicies();
  }, [userId]);

  const runAction = async (key, action, successMessage) => {
    setActionLoading(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      try { if (successMessage) showToast('success', successMessage); } catch (e) {}
      // Refresh policies after action
      const policiesRes = await policyApi.list({ owner: userId, limit: 100 });
      setPolicies(policiesRes.policies || []);
    } catch (err) {
      setError(getErrorMessage(err, "Action failed"));
    } finally {
      setActionLoading("");
    }
  };

  const showHistory = async (policy) => {
    setActionLoading(`history-${policy.id}`);
    setError("");
    try {
      const result = await policyApi.history(policy.id);
      setHistoryPolicy(policy);
      setHistoryEvents(result.events || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load policy history"));
    } finally {
      setActionLoading("");
    }
  };

  const extendPolicy = async (policy) => {
    const value = window.prompt("Enter the new end date as YYYY-MM-DD", "");
    if (!value) return;
    await runAction(
      `extend-${policy.id}`,
      () => policyApi.extend(policy.id, toIsoFromDateInput(value, true)),
      "Policy end date updated.",
    );
  };

  const deletePolicy = async (policy) => {
    if (!window.confirm(`Delete "${policy.title}" permanently?`)) return;
    await runAction(
      `delete-${policy.id}`,
      () => policyApi.delete(policy.id),
      "Policy deleted.",
    );
  };

  const clonePolicy = async (policy) => {
    await runAction(
      `clone-${policy.id}`,
      () => policyApi.clone(policy.id),
      "Policy cloned as a new draft.",
    );
  };

  return (
    <div>
      <PageHeader
        title={`Policies owned by ${planner?.email || "Planner"}`}
        description="View and manage all policies created by this planner."
        actions={
          <Link
            to="/policies"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Policies
          </Link>
        }
      />

      <div className="space-y-3">
        <ErrorAlert message={error} />
        {/* notices shown via global toasts */}
      </div>

      {loading ? (
        <LoadingState label="Loading policies" />
      ) : policies.length ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Policy Code</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Target Regions</th>
                  <th className="px-4 py-3 font-bold">Dates</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map((policy) => {
                  const busy = actionLoading.endsWith(policy.id);
                  const analyticsAllowed = [
                    "active",
                    "paused",
                    "closed",
                  ].includes(policy.status);
                  return (
                    <tr key={policy.id} className="align-top">
                      <td className="max-w-xs px-4 py-4">
                        <p className="font-bold text-slate-950">
                          {policy.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {policy.description}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs font-bold text-slate-700">
                        {policy.policyCode}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={policy.status} />
                      </td>
                      <td className="max-w-xs px-4 py-4 text-slate-600">
                        {policy.targetRegions?.join(", ") || "None"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div className="min-w-40">
                          {formatDate(policy.startDate)}
                        </div>
                        <div>{formatDate(policy.endDate)}</div>
                      </td>
                      <td className="min-w-[23rem] px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {analyticsAllowed ? (
                            <Link
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              to={`/policies/${policy.id}/analytics`}
                            >
                              <BarChart3 className="h-4 w-4" />
                              Analytics
                            </Link>
                          ) : null}
                          {policy.status === "draft" ? (
                            <Link
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              to={`/policies/${policy.id}/edit`}
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Link>
                          ) : null}
                          {policy.status === "draft" ? (
                            <Button
                              disabled={busy}
                              icon={Power}
                              onClick={() =>
                                runAction(
                                  `publish-${policy.id}`,
                                  () => policyApi.publish(policy.id),
                                  "Policy published.",
                                )
                              }
                            >
                              Publish
                            </Button>
                          ) : null}
                          {policy.status === "published" ? (
                            <Button
                              disabled={busy}
                              icon={RefreshCw}
                              onClick={() =>
                                runAction(
                                  `unpublish-${policy.id}`,
                                  () => policyApi.unpublish(policy.id),
                                  "Policy unpublished.",
                                )
                              }
                            >
                              Unpublish
                            </Button>
                          ) : null}
                          {policy.status === "active" ? (
                            <Button
                              disabled={busy}
                              icon={Pause}
                              onClick={() =>
                                runAction(
                                  `pause-${policy.id}`,
                                  () => policyApi.pause(policy.id),
                                  "Policy paused.",
                                )
                              }
                            >
                              Pause
                            </Button>
                          ) : null}
                          {policy.status === "paused" ? (
                            <Button
                              disabled={busy}
                              icon={Play}
                              onClick={() =>
                                runAction(
                                  `resume-${policy.id}`,
                                  () => policyApi.resume(policy.id),
                                  "Policy resumed.",
                                )
                              }
                            >
                              Resume
                            </Button>
                          ) : null}
                          {["active", "paused"].includes(policy.status) ? (
                            <>
                              <Button
                                disabled={busy}
                                icon={CalendarClock}
                                onClick={() => extendPolicy(policy)}
                              >
                                Extend
                              </Button>
                              <Button
                                disabled={busy}
                                icon={Power}
                                variant="danger"
                                onClick={() =>
                                  runAction(
                                    `close-${policy.id}`,
                                    () => policyApi.close(policy.id),
                                    "Policy closed.",
                                  )
                                }
                              >
                                Close
                              </Button>
                            </>
                          ) : null}
                          {["draft", "published"].includes(policy.status) ? (
                            <Button
                              disabled={busy}
                              icon={Trash2}
                              variant="danger"
                              onClick={() => deletePolicy(policy)}
                            >
                              Delete
                            </Button>
                          ) : null}
                          {policy.status !== "draft" &&
                          policy.status !== "archived" ? (
                            <Button
                              disabled={busy}
                              icon={Archive}
                              variant="danger"
                              onClick={() =>
                                runAction(
                                  `archive-${policy.id}`,
                                  () => policyApi.archive(policy.id),
                                  "Policy archived.",
                                )
                              }
                            >
                              Archive
                            </Button>
                          ) : null}
                          {policy.status === "archived" ? (
                            <Button
                              disabled={busy}
                              icon={RotateCcw}
                              onClick={() =>
                                runAction(
                                  `restore-${policy.id}`,
                                  () => policyApi.restore(policy.id),
                                  "Policy restored to draft.",
                                )
                              }
                            >
                              Restore
                            </Button>
                          ) : null}
                          <Button
                            disabled={busy}
                            icon={Copy}
                            onClick={() => clonePolicy(policy)}
                          >
                            Clone
                          </Button>
                          <Button
                            disabled={busy}
                            icon={History}
                            onClick={() => showHistory(policy)}
                          >
                            History
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No policies found for this planner"
            description="This planner has not created any policies yet."
            action={
              <Link
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
                to="/policies/new"
              >
                Create New Policy
              </Link>
            }
          />
        </div>
      )}

      {historyPolicy ? (
        <Modal
          title={`History: ${historyPolicy.title}`}
          onClose={() => setHistoryPolicy(null)}
        >
          {historyEvents.length ? (
            <ol className="space-y-3">
              {historyEvents.map((event, index) => (
                <li
                  key={`${event.action}-${event.timestamp}-${index}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{event.action}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(event.timestamp)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {event.userRole || "unknown role"}
                  </p>
                  {event.details ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No history events"
              description="This policy does not have audit events yet."
            />
          )}
        </Modal>
      ) : null}
    </div>
  );
}
