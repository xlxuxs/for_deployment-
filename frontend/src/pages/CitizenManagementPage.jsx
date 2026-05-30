import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";

export function CitizenManagementPage() {
  const [citizens, setCitizens] = useState([]);
  const [totalCitizens, setTotalCitizens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  const loadCitizens = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listCitizens({
        page,
        limit: 20,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      });
      setCitizens(result.citizens || []);
      setTotalCitizens(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load citizens"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCitizens();
  }, [page, activeFilter]);

  const filtered = searchEmail.trim()
    ? citizens.filter((c) =>
        c.email.toLowerCase().includes(searchEmail.toLowerCase()),
      )
    : citizens;

  const toggleStatus = async (citizen) => {
    setError("");
    setSuccessMessage("");
    setActionLoading((prev) => ({ ...prev, [citizen._id]: true }));
    try {
      const updatedActive = !citizen.active;
      await adminApi.updateCitizenStatus(citizen._id, updatedActive);
      setCitizens((prev) =>
        prev.map((c) =>
          c._id === citizen._id ? { ...c, active: updatedActive } : c,
        ),
      );
      setSuccessMessage(
        `${citizen.email} ${updatedActive ? "activated" : "deactivated"}.`,
      );
      try { showToast('success', `${citizen.email} ${updatedActive ? "activated" : "deactivated"}.`); } catch(e){}
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update citizen status"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [citizen._id]: false }));
    }
  };

  if (loading) return <LoadingState label="Loading citizens" />;

  return (
    <div>
      <PageHeader
        title="Citizen Management"
        description="View, filter, and manage citizen accounts. Activate or deactivate users."
      />
      <div className="space-y-5">
        <ErrorAlert message={error} />
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Total citizens: {totalCitizens}
            </span>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
            <p className="text-slate-600">No citizens found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Verified
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Joined
                  </th>
                  <th className="px-5 py-3 text-right font-bold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((citizen) => (
                  <tr
                    key={citizen._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 font-medium text-slate-950">
                      {citizen.email}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                          citizen.verified
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {citizen.verified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                          citizen.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {citizen.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {formatDate(citizen.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(citizen)}
                          disabled={actionLoading[citizen._id]}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            citizen.active
                              ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                              : "border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          } disabled:opacity-50`}
                        >
                          {actionLoading[citizen._id]
                            ? "..."
                            : citizen.active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
