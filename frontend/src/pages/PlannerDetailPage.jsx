import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { adminApi } from "../api/admin";
import { policyApi } from "../api/policies";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, getErrorMessage } from "../lib/format";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

function generatePassword() {
  const random = Math.random().toString(36).slice(2, 8);
  return `Planner-${random}42`;
}

export function PlannerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [planner, setPlanner] = useState(null);
  const [ownedPolicies, setOwnedPolicies] = useState([]);
  const [delegatedPolicies, setDelegatedPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPlanner, setEditingPlanner] = useState(null);
  const [editPassword, setEditPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const from = location.state?.from;

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const plannerData = await adminApi.getPlanner(id);
      setPlanner(plannerData);

      // Use enhanced fields from backend if available, otherwise fallback to separate API call
      if (plannerData.ownedPolicies) {
        setOwnedPolicies(plannerData.ownedPolicies);
      } else {
        const policiesData = await policyApi.list({ owner: id, limit: 100 });
        setOwnedPolicies(policiesData.policies || []);
      }

      if (plannerData.delegatedPolicies) {
        setDelegatedPolicies(plannerData.delegatedPolicies);
      } else {
        setDelegatedPolicies([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planner data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const toggleStatus = async () => {
    if (!planner) return;

    setError("");
    setActionLoading("status");

    try {
      const updatedActive = !planner.active;

      await adminApi.setPlannerStatus(planner._id, updatedActive);

      // update local planner instantly
      setPlanner((prev) => ({
        ...prev,
        active: updatedActive,
      }));

      // keep edit modal in sync if open
      setEditingPlanner((prev) =>
        prev ? { ...prev, active: updatedActive } : prev,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update status"));
    } finally {
      setActionLoading("");
    }
  };

  const savePlannerEdit = async () => {
    if (!editingPlanner) return;

    setError("");

    if (editPassword && editPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const payload = {
      active: editingPlanner.active,
      ...(editPassword && {
        password: editPassword,
      }),
    };

    try {
      setSubmitting(true);

      await adminApi.updatePlanner(editingPlanner._id, payload);

      // update planner locally
      setPlanner((prev) => ({
        ...prev,
        active: editingPlanner.active,
      }));

      setEditingPlanner(null);
      setEditPassword("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update planner"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPlanners = () => {
    if (from?.pathname === "/planners" && from.search) {
      navigate(from.pathname + from.search);
    } else {
      navigate("/planners");
    }
  };

  const handleBackToPolicies = () => {
    if (from?.pathname === "/policies") {
      navigate(from.pathname + (from.search || ""));
    } else {
      navigate("/policies");
    }
  };

  if (loading) return <LoadingState label="Loading planner details" />;
  if (error) return <ErrorAlert message={error} />;
  if (!planner)
    return (
      <EmptyState
        title="Planner not found"
        description="The planner does not exist or has been removed."
      />
    );

  return (
    <div>
      <PageHeader
        title={`Planner: ${planner.email}`}
        description="View planner details, manage account, and see their policies."
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleBackToPlanners}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ← Back to Planners
            </button>
            {from?.pathname === "/policies" && (
              <button
                onClick={handleBackToPolicies}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Back to Policies
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-3">
        <ErrorAlert message={error} />
      </div>

      {/* Planner Profile Card */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-lime-700 px-6 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20 backdrop-blur-sm">
                <UserCircle2 className="h-9 w-9 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-black tracking-tight">{planner.email}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${planner.active ? "bg-lime-300/20 text-lime-50 ring-1 ring-lime-200/30" : "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/30"}`}>
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {planner.active ? "Active planner" : "Deactivated planner"}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-slate-200/90">
                  Profile snapshot and moderation controls for this planner account.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
                    <Mail className="h-3.5 w-3.5" />
                    {planner.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
                    <MapPin className="h-3.5 w-3.5" />
                    {planner.region || "Not set"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Joined {formatDate(planner.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                onClick={toggleStatus}
                disabled={actionLoading === "status"}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  planner.active
                    ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                {actionLoading === "status"
                  ? "Updating..."
                  : planner.active
                    ? "Deactivate Account"
                    : "Activate Account"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <MapPin className="h-4 w-4 text-teal-700" />
              Region
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{planner.region || "Not set"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Cake className="h-4 w-4 text-teal-700" />
              Age range
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{planner.ageRange || "Not set"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <UserCircle2 className="h-4 w-4 text-teal-700" />
              Gender
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{planner.gender || "Not set"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <BriefcaseBusiness className="h-4 w-4 text-teal-700" />
              Occupation
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{planner.occupation || "Not set"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <GraduationCap className="h-4 w-4 text-teal-700" />
              Education
            </div>
            <p className="mt-3 text-lg font-bold text-slate-950">{planner.education || "Not set"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Languages className="h-4 w-4 text-teal-700" />
              Languages spoken
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(planner.languagesSpoken?.length ? planner.languagesSpoken : ["None"]).map((language) => (
                <span key={language} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                  {language}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Policies Owned by This Planner */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-lg font-bold text-slate-950">Policies Owned</h3>
          <p className="text-sm text-slate-600">
            All policies created by this planner (all statuses).
          </p>
        </div>
        {ownedPolicies.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            This planner has not created any policies yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Policy Code</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Start Date</th>
                  <th className="px-4 py-3 font-bold">End Date</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownedPolicies.map((policy) => (
                  <tr key={policy.id || policy._id}>
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      <Link
                        to={`/policies/${policy.id || policy._id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {policy.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">
                      {policy.policyCode}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={policy.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(policy.startDate)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(policy.endDate)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {["active", "paused", "closed"].includes(
                          policy.status,
                        ) && (
                          <Link
                            to={`/policies/${policy.id || policy._id}/analytics`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Analytics
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW: Delegated Policies (where planner is an associate) */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-lg font-bold text-slate-950">
            Delegated Policies
          </h3>
          <p className="text-sm text-slate-600">
            Policies where this planner is an accepted associate.
          </p>
        </div>
        {delegatedPolicies.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            This planner is not an associate on any policy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Policy Title</th>
                  <th className="px-4 py-3 font-bold">Policy Code</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Invited By</th>
                  <th className="px-4 py-3 font-bold">Accepted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delegatedPolicies.map((item) => (
                  <tr key={item.associateId}>
                    <td className="px-4 py-4 font-semibold text-slate-950">
                      <Link
                        to={`/policies/${item.policy._id}`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {item.policy.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">
                      {item.policy.policyCode}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.policy.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.invitedBy?.email || "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(item.acceptedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal (unchanged) */}
      {editingPlanner ? (
        <Modal
          title={`Edit ${editingPlanner.email}`}
          onClose={() => setEditingPlanner(null)}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={editingPlanner.active}
                onChange={(event) =>
                  setEditingPlanner((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />
              Account active
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={savePlannerEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {submitting ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setEditPassword(generatePassword())}
              >
                Generate password
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
