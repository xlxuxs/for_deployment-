import { Eye, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";
import { ETHIOPIAN_REGIONS } from "../constants/regions";
import { useI18n } from "../i18n/I18nProvider";

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

export function PlannersListPage() {
  const { t } = useI18n();
  const location = useLocation();
  const [planners, setPlanners] = useState([]);
  const [totalPlanners, setTotalPlanners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  // Create planner modal demographic states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRegion, setNewRegion] = useState("Addis Ababa");
  const [newAgeRange, setNewAgeRange] = useState("25-34");
  const [newGender, setNewGender] = useState("prefer-not-to-say");
  const [newOccupation, setNewOccupation] = useState("government-employee");
  const [newEducation, setNewEducation] = useState("bachelors");
  const [newPreferredLanguage, setNewPreferredLanguage] = useState("en");
  const [newLanguagesSpoken, setNewLanguagesSpoken] = useState(["en"]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadPlanners = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listPlanners({
        page,
        limit: 20,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      });
      setPlanners(result.planners || []);
      setTotalPlanners(result.total || 0);
      setTotalPages(result.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load planners"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanners();
  }, [page, activeFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") === "true") {
      setCreateError("");
      setShowCreateModal(true);
      // Clean query parameter from address bar
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [location.search]);

  const filtered = searchEmail.trim()
    ? planners.filter((p) =>
        p.email.toLowerCase().includes(searchEmail.toLowerCase()),
      )
    : planners;

  const toggleStatus = async (planner) => {
    setError("");
    setActionLoading((prev) => ({ ...prev, [planner._id]: true }));
    try {
      const updatedActive = !planner.active;
      await adminApi.setPlannerStatus(planner._id, updatedActive);
      setPlanners((prev) =>
        prev.map((p) =>
          p._id === planner._id ? { ...p, active: updatedActive } : p,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update planner status"));
    } finally {
      setActionLoading((prev) => ({ ...prev, [planner._id]: false }));
    }
  };

  const handleCreatePlanner = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!newEmail || !newRegion || !newAgeRange || !newGender || !newOccupation || !newEducation) {
      setCreateError("Email, region, age range, gender, occupation, and education level are required.");
      return;
    }

    setCreateSubmitting(true);
    try {
      await adminApi.createPlanner({
        email: newEmail.trim(),
        region: newRegion,
        ageRange: newAgeRange,
        gender: newGender,
        occupation: newOccupation,
        education: newEducation,
        preferredLanguage: newPreferredLanguage,
        languagesSpoken: newLanguagesSpoken,
      });

      // Reset form fields
      setNewEmail("");
      setNewRegion("Addis Ababa");
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
          t("Planner account created. A password setup link was sent to the planner."),
        );
      } catch {
        /* ignore */
      }

      // Reload planners list to display the new entry
      await loadPlanners();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create planner account"));
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading planners" />;

  return (
    <div>
      <PageHeader
        title="Planner accounts"
        description="View, filter, and manage planner accounts. Activate or deactivate users."
        actions={
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-teal-800 transition-all duration-200"
          >
            <UserPlus className="h-4 w-4" />
            {t("Create Planner")}
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
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">
              {t("Total planners:")} {totalPlanners}
            </span>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              <option value="">{t("All Status")}</option>
              <option value="true">{t("Active")}</option>
              <option value="false">{t("Inactive")}</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
            <p className="text-slate-600">No planners found.</p>
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
                    Status
                  </th>
                  <th className="px-5 py-3 text-left font-bold text-slate-700">
                    Created At
                  </th>
                  <th className="px-5 py-3 text-right font-bold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((planner) => (
                  <tr
                    key={planner._id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/planners/${planner._id}`}
                        state={{
                          from: {
                            pathname: "/planners",
                            search: location.search,
                            label: "Planners",
                          },
                        }}
                        className="font-medium text-slate-950 hover:text-teal-700 hover:underline"
                      >
                        {planner.email}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                          planner.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {planner.active ? t("Active") : t("Inactive")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">
                      {formatDate(planner.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/planners/${planner._id}`}
                          state={{
                            from: {
                              pathname: "/planners",
                              search: location.search,
                              label: "Planners",
                            },
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t("View details")}
                        </Link>
                        <button
                          onClick={() => toggleStatus(planner)}
                          disabled={actionLoading[planner._id]}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            planner.active
                              ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                              : "border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          } disabled:opacity-50`}
                        >
                          {actionLoading[planner._id]
                            ? "..."
                            : planner.active
                              ? t("Deactivate")
                              : t("Activate")}
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
              {t("Page")} {page} {t("of")} {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("Previous")}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("Next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal
          title="Create New Planner Account"
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreatePlanner} className="space-y-6">
            <ErrorAlert message={createError} />

            {/* Section: Credentials */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Account Credentials
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Email Address</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="planner@example.com"
                  />
                </label>
              </div>
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                The planner will receive a password setup link by email after the account is created.
              </div>
            </div>

            {/* Section: Demographics */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Demographic Profile
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Region</span>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {ETHIOPIAN_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Age Range</span>
                  <select
                    value={newAgeRange}
                    onChange={(e) => setNewAgeRange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {AGE_RANGES.map((range) => (
                      <option key={range} value={range}>
                        {range}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Gender</span>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Section: Background */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Background Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Occupation</span>
                  <select
                    value={newOccupation}
                    onChange={(e) => setNewOccupation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {OCCUPATIONS.map((occ) => (
                      <option key={occ.value} value={occ.value}>
                        {occ.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Education Level</span>
                  <select
                    value={newEducation}
                    onChange={(e) => setNewEducation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {EDUCATIONS.map((edu) => (
                      <option key={edu.value} value={edu.value}>
                        {edu.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Section: Languages */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
                Languages & Accessibility
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Preferred Language</span>
                  <select
                    value={newPreferredLanguage}
                    onChange={(e) => setNewPreferredLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 text-sm"
                  >
                    {LANG_OPTIONS.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="block">
                  <span className="text-sm font-semibold text-slate-700 block mb-1">Languages Spoken</span>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {LANG_OPTIONS.map((lang) => (
                      <label key={lang.value} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newLanguagesSpoken.includes(lang.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewLanguagesSpoken([...newLanguagesSpoken, lang.value]);
                            } else {
                              setNewLanguagesSpoken(newLanguagesSpoken.filter((l) => l !== lang.value));
                            }
                          }}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {createSubmitting ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
