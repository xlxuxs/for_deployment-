import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { plannerApi } from "../api/plannerApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

import { formatDate } from "../lib/format";

export function DelegatedPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await plannerApi.getMyAssociatePolicies();
        setPolicies(data);
      } catch (err) {
        setError(err.message || "Failed to load delegated policies");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState label="Loading delegated policies" />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <PageHeader
        title="My Delegated Policies"
        description="Policies where you are an associate (accepted invitations)."
      />
      {policies.length === 0 ? (
        <div className="mt-6 rounded-lg border bg-white p-8 text-center text-slate-500">
          You are not an associate for any policy yet.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {policies.map((item) => (
            <Link
              key={item.associateId}
              to={`/policies/${item.policy._id}/delegated`}
              className="block rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-bold text-slate-950">
                  {item.policy.title}
                </h3>
                <StatusBadge status={item.policy.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {item.policy.policyCode}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Message: {item.message || "No message"}
              </p>
              <p className="text-xs text-slate-500">
                Accepted on: {formatDate(item.acceptedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
