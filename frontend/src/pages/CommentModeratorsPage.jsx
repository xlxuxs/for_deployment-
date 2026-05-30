import { RefreshCw, UserCircle, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ETHIOPIAN_REGIONS } from "../constants/regions";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];
const OCCUPATIONS = [
  { value: "student", label: "Student" },
  { value: "farmer", label: "Farmer" },
  { value: "merchant", label: "Merchant" },
  { value: "government-employee", label: "Government Employee" },
  { value: "private-sector", label: "Private Sector" },
  { value: "unemployed", label: "Unemployed" },
  { value: "other", label: "Other" },
];
const EDUCATIONS = [
  { value: "no-formal", label: "No Formal Education" },
  { value: "primary", label: "Primary School" },
  { value: "secondary", label: "Secondary School" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's Degree" },
  { value: "postgraduate", label: "Postgraduate Degree" },
];
const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "am", label: "Amharic" },
  { value: "om", label: "Oromo" },
  { value: "ti", label: "Tigrinya" },
];

export function CommentModeratorsPage() {
  const [moderators, setModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [totalModerators, setTotalModerators] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRegion, setNewRegion] = useState("Addis Ababa");
  const [newRegionOther, setNewRegionOther] = useState("");
  const [newAgeRange, setNewAgeRange] = useState("25-34");
  const [newGender, setNewGender] = useState("prefer-not-to-say");
  const [newOccupation, setNewOccupation] = useState("government-employee");
  const [newEducation, setNewEducation] = useState("bachelors");
  const [newPreferredLanguage, setNewPreferredLanguage] = useState("en");
  const [newLanguagesSpoken, setNewLanguagesSpoken] = useState(["en"]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const toggleLanguageSpoken = (value) => {
    setNewLanguagesSpoken((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const loadModerators = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listCommentModerators({
        page,
        limit: 20,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      });
      setModerators(result.moderators || []);
      setTotalModerators(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load comment moderators"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModerators();
  }, [page, activeFilter]);

  const filteredModerators = searchEmail.trim()
    ? moderators.filter((moderator) =>
        moderator.email.toLowerCase().includes(searchEmail.toLowerCase()),
      )
    : moderators;

  const toggleStatus = async (moderator) => {
    setError("");
    setActionLoading((prev) => ({ ...prev, [moderator._id]: true }));
    try {
      const updatedActive = !moderator.active;
      await adminApi.setCommentModeratorStatus(moderator._id, updatedActive);
      setModerators((prev) =>
        prev.map((item) =>
          item._id === moderator._id ? { ...item, active: updatedActive } : item,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update moderator status"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [moderator._id]: false }));
    }
  };

  const handleCreateModerator = async (event) => {
    event.preventDefault();
    setCreateError("");

    if (!newEmail.trim()) {
      setCreateError("Email is required.");
      return;
    }
    const resolvedRegion =
      newRegion === "other" ? newRegionOther.trim() : newRegion.trim();
    if (
      !resolvedRegion ||
      !newAgeRange ||
      !newGender ||
      !newOccupation ||
      !newEducation ||
      !newPreferredLanguage
    ) {
      setCreateError("Please complete all moderator profile fields.");
      return;
    }

    setCreateSubmitting(true);
    try {
      await adminApi.createCommentModerator({
        email: newEmail.trim(),
        region: resolvedRegion,
        ageRange: newAgeRange,
        gender: newGender,
        occupation: newOccupation,
        education: newEducation,
        preferredLanguage: newPreferredLanguage,
        languagesSpoken: newLanguagesSpoken,
      });
      setNewEmail("");
      setNewRegion("Addis Ababa");
      setNewRegionOther("");
      setNewAgeRange("25-34");
      setNewGender("prefer-not-to-say");
      setNewOccupation("government-employee");
      setNewEducation("bachelors");
      setNewPreferredLanguage("en");
      setNewLanguagesSpoken(["en"]);
      setShowCreateModal(false);
      try {
        showToast(
          "success",
          "Comment moderator account created. A password setup link was sent.",
        );
      } catch {
        /* ignore toast errors */
      }
      await loadModerators();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create comment moderator"));
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading comment moderators" />;

  return (
    <div>
      <PageHeader
        title="Comment moderators"
        description="Create and manage staff accounts that only handle comment moderation."
        actions={
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-teal-800"
          >
            <UserPlus className="h-4 w-4" />
            Create Comment Moderator
          </button>
        }
      />

      <div className="space-y-5">
        <ErrorAlert message={error} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Total moderators: {totalModerators}
            </span>
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button
              onClick={loadModerators}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {filteredModerators.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
            <p className="text-slate-600">No comment moderators found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">Email</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">Status</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">Created At</th>
                  <th className="px-5 py-3 text-right font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredModerators.map((moderator) => (
                  <tr key={moderator._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-teal-700">
                          <UserCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{moderator.email}</p>
                          <p className="text-xs text-slate-500">{moderator.region || "Unknown region"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {moderator.ageRange || "Unknown age"} • {moderator.gender || "Unknown gender"} • {moderator.occupation || "Unknown occupation"} • {moderator.education || "Unknown education"}
                          </p>
                          <p className="text-xs text-slate-400">
                            Pref: {moderator.preferredLanguage || "Unknown"} • Speaks: {(moderator.languagesSpoken || []).join(", ") || "Unknown"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${moderator.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {moderator.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(moderator.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(moderator)}
                        disabled={actionLoading[moderator._id]}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {actionLoading[moderator._id]
                          ? "Updating..."
                          : moderator.active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal title="Create Comment Moderator" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateModerator} className="space-y-4">
            <ErrorAlert message={createError} />
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                placeholder="moderator@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Region</span>
              <select
                value={newRegion}
                onChange={(event) => {
                  setNewRegion(event.target.value);
                  if (event.target.value !== "other") {
                    setNewRegionOther("");
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              >
                {ETHIOPIAN_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
            </label>
            {newRegion === "other" && (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Specify region</span>
                <input
                  type="text"
                  value={newRegionOther}
                  onChange={(event) => setNewRegionOther(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  placeholder="Enter region name"
                />
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Age range</span>
                <select value={newAgeRange} onChange={(event) => setNewAgeRange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  {AGE_RANGES.map((age) => <option key={age} value={age}>{age}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Gender</span>
                <select value={newGender} onChange={(event) => setNewGender(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  {GENDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Occupation</span>
                <select value={newOccupation} onChange={(event) => setNewOccupation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  {OCCUPATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Education</span>
                <select value={newEducation} onChange={(event) => setNewEducation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  {EDUCATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Preferred language</span>
                <select value={newPreferredLanguage} onChange={(event) => setNewPreferredLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  {LANG_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Languages spoken</span>
                <p className="mt-1 text-xs text-slate-500">Select all languages the moderator can work in.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {LANG_OPTIONS.map((item) => (
                    <label
                      key={item.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${newLanguagesSpoken.includes(item.value) ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={newLanguagesSpoken.includes(item.value)}
                        onChange={() => toggleLanguageSpoken(item.value)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span className="font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </label>
            </div>
            <p className="text-xs text-slate-500">
              The account will be created with comment-moderator permissions only, and a password setup email will be sent automatically.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {createSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
