import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom"; // add useSearchParams
import { plannerApi } from "../api/plannerApi";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { Modal } from "../components/Modal";
import { formatDate } from "../lib/format";

export function PendingInvitationsPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [previewInvitation, setPreviewInvitation] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const [pendingInvitations, invitationHistory] = await Promise.all([
        plannerApi.getPendingInvitations(),
        plannerApi.getInvitationHistory(),
      ]);
      setInvitations(pendingInvitations);
      setHistory(invitationHistory);
    } catch (err) {
      setError(err.message || "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  // Effect for highlighting
  useEffect(() => {
    if (highlightId && invitations.length > 0) {
      // Wait for DOM to render
      setTimeout(() => {
        const element = document.getElementById(`invitation-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add(
            "ring-2",
            "ring-teal-500",
            "bg-teal-50",
            "transition-all",
          );
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-teal-500", "bg-teal-50");
          }, 3000);
        }
      }, 100);
    }
  }, [highlightId, invitations]);

  const handleAccept = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await plannerApi.acceptInvitation(invitationId);
      await loadInvitations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      await plannerApi.rejectInvitation(invitationId, "User declined");
      await loadInvitations();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingState label="Loading invitations" />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <PageHeader
        title="Pending Invitations"
        description="Invitations to become an associate on policies"
      />

      <div className="mt-5 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("pending")}
          className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
            activeTab === "pending"
              ? "border-b-2 border-teal-700 text-teal-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pending ({invitations.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`rounded-t-lg px-4 py-2 text-sm font-bold ${
            activeTab === "history"
              ? "border-b-2 border-teal-700 text-teal-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          History ({history.length})
        </button>
      </div>

      {activeTab === "pending" && invitations.length === 0 ? (
        <div className="mt-6 rounded-lg border bg-white p-8 text-center text-slate-500">
          No pending invitations.
        </div>
      ) : activeTab === "pending" ? (
        <div className="mt-6 space-y-4">
          {invitations.map((inv) => (
            <div
              key={inv._id}
              id={`invitation-${inv._id}`}
              className="rounded-lg border bg-white p-4 shadow-sm transition"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold text-slate-950">
                  {inv.policyId.title}
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  Expires in {inv.daysRemaining} days
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {inv.policyId.description?.slice(0, 120)}...
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>Invited by: {inv.assignedBy?.email}</span>
                <span>Invited: {formatDate(inv.invitedAt)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Message: {inv.metadata?.notes || "No message"}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => setPreviewInvitation(inv)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Preview Policy
                </button>
                <button
                  onClick={() => handleAccept(inv._id)}
                  disabled={actionLoading === inv._id}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(inv._id)}
                  disabled={actionLoading === inv._id}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="mt-6 rounded-lg border bg-white p-8 text-center text-slate-500">
          No invitation history yet.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Policy</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Invited by</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((inv) => (
                <tr key={inv._id}>
                  <td className="px-4 py-4 font-semibold text-slate-950">
                    {inv.policyId?.title || "Deleted policy"}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-700">
                      {inv.displayStatus || inv.invitationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {inv.assignedBy?.email || "Unknown"}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {formatDate(inv.invitedAt || inv.createdAt)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {inv.acceptedAt
                      ? `Accepted ${formatDate(inv.acceptedAt)}`
                      : inv.rejectedAt
                        ? `Rejected ${formatDate(inv.rejectedAt)}`
                        : inv.revokedAt
                          ? `Revoked ${formatDate(inv.revokedAt)}`
                          : inv.displayStatus === "expired"
                            ? "Expired"
                            : "Awaiting response"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal – same as before */}
      {previewInvitation && (
        <Modal
          title={`Policy: ${previewInvitation.policyId.title}`}
          onClose={() => setPreviewInvitation(null)}
          size="lg"
        >
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {previewInvitation.policyId.description}
            </p>
            <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
              <p className="font-semibold">Invitation Message</p>
              <p className="mt-1 whitespace-pre-wrap">
                {previewInvitation.metadata?.notes || "No message provided."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold">Status:</span>
              <span>{previewInvitation.policyId.status}</span>
              <span className="font-semibold">Start Date:</span>
              <span>{formatDate(previewInvitation.policyId.startDate)}</span>
              <span className="font-semibold">End Date:</span>
              <span>{formatDate(previewInvitation.policyId.endDate)}</span>
              <span className="font-semibold">Poll Type:</span>
              <span>{previewInvitation.policyId.pollType}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setPreviewInvitation(null);
                  handleAccept(previewInvitation._id);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-white"
              >
                Accept Now
              </button>
              <button
                onClick={() => setPreviewInvitation(null)}
                className="rounded-lg border px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
