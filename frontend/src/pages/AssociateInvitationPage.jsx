import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { plannerApi } from "../api/plannerApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageHeader } from "../components/PageHeader";

export function AssociateInvitationPage() {
  const { associateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [action, setAction] = useState(null); // 'accept' or 'reject'

  useEffect(() => {
    const actionParam = searchParams.get("action");
    if (actionParam === "accept") setAction("accept");
    else if (actionParam === "reject") setAction("reject");
    else setAction(null);

    // Fetch invitation details to show policy info
    plannerApi
      .getInvitationDetails(associateId)
      .then(setInvitation)
      .catch((err) =>
        setError(err.message || "Invitation not found or expired"),
      )
      .finally(() => setLoading(false));
  }, [associateId, searchParams]);

  const performAction = async (requestedAction = action) => {
    setLoading(true);
    try {
      if (requestedAction === "accept") {
        await plannerApi.acceptInvitation(associateId);
        navigate("/associates/policies", {
          state: { message: "Invitation accepted! You now have access." },
        });
      } else if (requestedAction === "reject") {
        await plannerApi.rejectInvitation(
          associateId,
          "Rejected via email link",
        );
        navigate("/dashboard", {
          state: { message: "Invitation rejected." },
        });
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) return <LoadingState label="Processing invitation..." />;
  if (error) return <ErrorAlert message={error} />;
  if (!invitation) return <ErrorAlert message="Invitation not found" />;

  const isExpired = invitation.isExpired || invitation.daysRemaining <= 0;
  const invitationMessage = invitation.metadata?.notes || "";

  return (
    <div className="mx-auto mt-12 max-w-lg">
      <PageHeader title="Associate Invitation" />
      {isExpired ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
          This invitation has expired. Please contact the policy owner for a new
          invitation.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">{invitation.policyId.title}</h2>
          <p className="mt-2 text-slate-600">
            {invitation.policyId.description}
          </p>
          <div className="mt-4 text-sm text-slate-500">
            <p>Invited by: {invitation.assignedBy?.email}</p>
            <p>Expires in: {invitation.daysRemaining} days</p>
          </div>
          <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
            <p className="font-semibold">Invitation Message</p>
            <p className="mt-1 whitespace-pre-wrap">
              {invitationMessage || "No message provided."}
            </p>
          </div>
          {action ? (
            <div className="mt-6">
              <p className="mb-4">
                You are about to <strong>{action}</strong> this invitation.
              </p>
              <button
                onClick={performAction}
                className="rounded-lg bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
              >
                Confirm {action === "accept" ? "Accept" : "Reject"}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => {
                  setAction("accept");
                  performAction("accept");
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-white"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setAction("reject");
                  performAction("reject");
                }}
                className="rounded-lg border px-4 py-2"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
