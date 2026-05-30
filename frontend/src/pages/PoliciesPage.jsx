import {
  BarChart3,
  FilePlus,
  History,
  Edit,
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; // added useNavigate
import CreatableSelect from "react-select/creatable";
import { policyApi } from "../api/policies";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatAuditDetails } from "../utils/auditFormatter";
import { ETHIOPIAN_REGIONS, POLICY_STATUSES } from "../constants/regions";
import { formatDate, getErrorMessage, toIsoFromDateInput } from "../lib/format";
import { showToast } from "../lib/toast";
import { useAuth } from "../auth/AuthContext";
import { useDebounce } from "../hooks/useDebounce";

const PAGE_SIZE = 10;

const PREDEFINED_TOPICS = [
  "Agriculture",
  "Health",
  "Education",
  "Infrastructure",
  "Economy",
  "Security",
  "Environment",
  "Transport",
  "Technology",
  "Social Welfare",
  "Taxation",
  "Housing",
  "Water Supply",
  "Electricity",
  "Employment",
  "Tourism",
  "Mining",
  "Trade",
  "Justice",
  "Defense",
  "Diaspora",
];

const topicOptions = PREDEFINED_TOPICS.map((t) => ({ value: t, label: t }));

const defaultFilters = {
  status: "",
  region: "",
  pollType: "",
  search: "",
  startDate: "",
  endDate: "",
  topics: [],
  relevance: {
    women: false,
    youth: false,
    farmers: false,
    urban: false,
    rural: false,
    privateSector: false,
    government: false,
  },
};

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

export function PoliciesPage() {
  const { role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); // for cloning redirect

  const [activeTab, setActiveTab] = useState("my");
  const [myPage, setMyPage] = useState(1);
  const [delegatedPage, setDelegatedPage] = useState(1);
  const [otherPage, setOtherPage] = useState(1);

  const [dataPerTab, setDataPerTab] = useState({
    my: [],
    delegated: [],
    other: [],
  });
  const [filtersPerTab, setFiltersPerTab] = useState({
    my: { ...defaultFilters },
    delegated: { ...defaultFilters },
    other: { ...defaultFilters },
  });
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [historyPolicy, setHistoryPolicy] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);

  const debouncedSearch = useDebounce(filters.search, 500);

  const getStatusOptions = () => {
    if (activeTab === "my") {
      return ["draft", "published", "active", "paused", "closed", "archived"];
    }
    if (activeTab === "delegated") {
      return ["draft", "published", "active", "paused", "closed"];
    }
    if (activeTab === "other") {
      if (role === "admin") {
        return ["draft", "published", "active", "paused", "closed", "archived"];
      } else {
        return ["active", "paused", "closed"];
      }
    }
    return [];
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setFiltersPerTab((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value },
    }));
  };

  const updateRelevance = (factor, checked) => {
    const newRelevance = { ...filters.relevance, [factor]: checked };
    updateFilter("relevance", newRelevance);
  };

  const getRelevanceString = (relevance) =>
    Object.entries(relevance)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .join(",");

  const loadDataForTab = async (tab) => {
    const tabFilters = filtersPerTab[tab];
    const params = {};
    if (tabFilters.status) params.status = tabFilters.status;
    if (tabFilters.region) params.region = tabFilters.region;
    if (tabFilters.pollType) params.pollType = tabFilters.pollType;
    if (tabFilters.search) params.search = tabFilters.search;
    if (tabFilters.startDate) params.startDate = tabFilters.startDate;
    if (tabFilters.endDate) params.endDate = tabFilters.endDate;
    if (tabFilters.topics.length) {
      params.topics = tabFilters.topics.map((t) => t.value);
    }
    const relevanceStr = getRelevanceString(tabFilters.relevance);
    if (relevanceStr) params.relevanceFactors = relevanceStr;

    try {
      const result = await policyApi.getCategorizedPolicies(params);
      let dataArray = [];
      if (tab === "my") dataArray = result.owned || [];
      else if (tab === "delegated") dataArray = result.delegated || [];
      else dataArray = result.other || [];
      dataArray = dataArray.map((p) => ({ ...p, id: p.id || p._id }));
      setDataPerTab((prev) => ({ ...prev, [tab]: dataArray }));
    } catch (err) {
      if (tab === activeTab)
        setError(getErrorMessage(err, "Failed to load policies"));
    }
  };

  const loadDataForActiveTab = async (showInitial = false) => {
    if (showInitial) setInitialLoading(true);
    else setRefreshing(true);
    setError("");
    const tabFilters = filters;
    const params = {};
    if (tabFilters.status) params.status = tabFilters.status;
    if (tabFilters.region) params.region = tabFilters.region;
    if (tabFilters.pollType) params.pollType = tabFilters.pollType;
    if (debouncedSearch) params.search = debouncedSearch;
    if (tabFilters.startDate) params.startDate = tabFilters.startDate;
    if (tabFilters.endDate) params.endDate = tabFilters.endDate;
    if (tabFilters.topics.length) {
      params.topics = tabFilters.topics.map((t) => t.value);
    }
    const relevanceStr = getRelevanceString(tabFilters.relevance);
    if (relevanceStr) params.relevanceFactors = relevanceStr;

    try {
      const result = await policyApi.getCategorizedPolicies(params);
      let dataArray = [];
      if (activeTab === "my") dataArray = result.owned || [];
      else if (activeTab === "delegated") dataArray = result.delegated || [];
      else dataArray = result.other || [];
      dataArray = dataArray.map((p) => ({ ...p, id: p.id || p._id }));
      setDataPerTab((prev) => ({ ...prev, [activeTab]: dataArray }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load policies"));
    } finally {
      if (showInitial) setInitialLoading(false);
      else setRefreshing(false);
    }
  };

  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setFiltersPerTab((prev) => ({ ...prev, [activeTab]: filters }));
    const newFilters = filtersPerTab[newTab];
    setFilters(newFilters);
    setActiveTab(newTab);
    setMyPage(1);
    setDelegatedPage(1);
    setOtherPage(1);
    if (dataPerTab[newTab].length === 0) loadDataForTab(newTab);
  };

  useEffect(() => {
    loadDataForActiveTab(true);
  }, []);

  useEffect(() => {
    if (!initialLoading) loadDataForActiveTab();
  }, [
    filters.status,
    filters.region,
    filters.pollType,
    debouncedSearch,
    filters.startDate,
    filters.endDate,
    filters.topics,
    filters.relevance,
  ]);

  useEffect(() => {
    if (!initialLoading) {
      const tabs = ["my", "delegated", "other"].filter((t) => t !== activeTab);
      tabs.forEach((tab) => {
        if (dataPerTab[tab].length === 0) loadDataForTab(tab);
      });
    }
  }, [initialLoading]);

  const paginate = (items, page) =>
    items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    const newFilters = { ...defaultFilters };
    updateFilter("status", newFilters.status);
    updateFilter("region", newFilters.region);
    updateFilter("pollType", newFilters.pollType);
    updateFilter("search", newFilters.search);
    updateFilter("startDate", newFilters.startDate);
    updateFilter("endDate", newFilters.endDate);
    updateFilter("topics", newFilters.topics);
    updateFilter("relevance", { ...newFilters.relevance });
  };

  const runAction = async (key, action, successMessage) => {
    setActionLoading(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      try { showToast('success', successMessage); } catch (e) {}
      await loadDataForActiveTab();
      const otherTabs = ["my", "delegated", "other"].filter(
        (t) => t !== activeTab,
      );
      await Promise.all(otherTabs.map((tab) => loadDataForTab(tab)));
    } catch (err) {
      setError(getErrorMessage(err, "Action failed"));
    } finally {
      setActionLoading("");
    }
  };

  const extendPolicy = async (policy) => {
    const newEnd = window.prompt("Enter new end date (YYYY-MM-DD)", "");
    if (!newEnd) return;
    await runAction(
      `extend-${policy.id}`,
      () => policyApi.extend(policy.id, toIsoFromDateInput(newEnd, true)),
      "End date updated.",
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
    setActionLoading(`clone-${policy.id}`);
    setError("");
    try {
      const result = await policyApi.clone(policy.id);
      setNotice(`Policy cloned as a new draft. Redirecting to edit...`);
      try { showToast('success', `Policy cloned as a new draft. Redirecting to edit...`); } catch (e) {}
      navigate(`/policies/${result.id}/edit`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to clone policy"));
    } finally {
      setActionLoading("");
    }
  };

  const showHistory = async (policy) => {
    setActionLoading(`history-${policy.id}`);
    try {
      const result = await policyApi.history(policy.id);
      setHistoryPolicy(policy);
      setHistoryEvents(result.events || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load history"));
    } finally {
      setActionLoading("");
    }
  };

  const getCreatorEmail = (policy) => {
    if (policy.createdBy && typeof policy.createdBy === "object")
      return policy.createdBy.email;
    if (typeof policy.createdBy === "string") return policy.createdBy;
    return "Unknown";
  };

  const renderPolicyTable = (policies, tab, page, setPage) => {
    const totalPages = Math.ceil(policies.length / PAGE_SIZE);
    const paginated = paginate(policies, page);
    if (!policies.length)
      return (
        <div className="py-8 text-center text-slate-500">
          No policies match your filters.
        </div>
      );

    return (
      <>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dates</th>
                {tab === "delegated" && (
                  <th className="px-4 py-3">Invited By</th>
                )}
                {role === "admin" && tab === "other" && (
                  <th className="px-4 py-3">Creator</th>
                )}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((policy) => {
                const busy = actionLoading.endsWith(policy.id);
                const analyticsAllowed = [
                  "active",
                  "paused",
                  "closed",
                  "archived",
                ].includes(policy.status);
                const modifyAllowed = tab === "my" || role === "admin";
                return (
                  <tr key={policy.id} className="align-top">
                    <td className="px-4 py-4">
                      {tab === "my" && (
                        <Link
                          to={
                            policy.status === "draft"
                              ? `/policies/${policy.id}/edit`
                              : `/policies/${policy.id}`
                          }
                          className="font-bold hover:text-teal-700"
                        >
                          {policy.title}
                        </Link>
                      )}
                      {tab === "delegated" && (
                        <span className="font-bold text-slate-950">
                          {policy.title}
                        </span>
                      )}
                      {tab === "other" && (
                        <Link
                          to={
                            role === "admin"
                              ? `/policies/${policy.id}`
                              : `/policies/${policy.id}/readonly`
                          }
                          className="font-bold hover:text-teal-700"
                        >
                          {policy.title}
                        </Link>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {policy.policyCode}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={policy.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      <div>{formatDate(policy.startDate)}</div>
                      <div className="text-xs text-slate-400">
                        {formatDate(policy.endDate)}
                      </div>
                    </td>
                    {tab === "delegated" && (
                      <td className="px-4 py-4">{policy.invitedBy}</td>
                    )}
                    {role === "admin" && tab === "other" && (
                      <td className="px-4 py-4">
                        <Link
                          to={`/planners/${policy.createdBy?._id || policy.createdBy}`}
                          state={{
                            from: {
                              pathname: "/policies",
                              search: location.search,
                              label: "Policies",
                            },
                          }}
                          className="text-teal-700 hover:underline"
                        >
                          {getCreatorEmail(policy)}
                        </Link>
                      </td>
                    )}
                    <td className="min-w-[12rem] px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {analyticsAllowed && (
                          <Link
                            to={`/policies/${policy.id}/analytics`}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <BarChart3 className="h-4 w-4" /> Analytics
                          </Link>
                        )}
                        {tab === "my" &&
                          modifyAllowed &&
                          policy.status === "draft" && (
                            <Link
                              to={`/policies/${policy.id}/edit`}
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <Edit className="h-4 w-4" /> Edit
                            </Link>
                          )}
                        {tab === "my" && (
                          <Button
                            icon={History}
                            onClick={() => showHistory(policy)}
                            disabled={busy}
                          >
                            History
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 text-sm">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </>
    );
  };

  if (initialLoading) return <LoadingState label="Loading policies" />;

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Create and manage policy drafts, view analytics for active/paused/closed/archived."
        actions={
          <Link
            to="/policies/new"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
          >
            <FilePlus className="h-4 w-4" /> Create New Policy
          </Link>
        }
      />
      <ErrorAlert message={error} />
      {/* notice is shown via global toasts */}

      <div className="mt-5 border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => handleTabChange("my")}
            className={`px-4 py-2 text-sm font-medium ${activeTab === "my" ? "border-b-2 border-teal-700 text-teal-700" : "text-slate-500"}`}
          >
            My Policies ({dataPerTab.my.length})
          </button>
          {role === "planner" && (
            <button
              onClick={() => handleTabChange("delegated")}
              className={`px-4 py-2 text-sm font-medium ${activeTab === "delegated" ? "border-b-2 border-teal-700 text-teal-700" : "text-slate-500"}`}
            >
              Delegated Policies ({dataPerTab.delegated.length})
            </button>
          )}
          <button
            onClick={() => handleTabChange("other")}
            className={`px-4 py-2 text-sm font-medium ${activeTab === "other" ? "border-b-2 border-teal-700 text-teal-700" : "text-slate-500"}`}
          >
            Other Policies ({dataPerTab.other.length})
          </button>
        </nav>
      </div>

      {/* Filters section */}
      <section className="mt-5 rounded-lg border p-4 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
                placeholder="Search by title or code"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </label>
          </div>
          <select
            className="rounded-lg border px-3 py-2.5 text-sm"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {getStatusOptions().map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2.5 text-sm"
            value={filters.region}
            onChange={(e) => updateFilter("region", e.target.value)}
          >
            <option value="">All regions</option>
            {ETHIOPIAN_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2.5 text-sm"
            value={filters.pollType}
            onChange={(e) => updateFilter("pollType", e.target.value)}
          >
            <option value="">All poll types</option>
            <option value="binary">Binary</option>
            <option value="multipleChoice">Multiple Choice</option>
            <option value="likert">Likert</option>
            <option value="approval">Approval</option>
            <option value="rating">Rating</option>
            <option value="rankedChoice">Ranked Choice</option>
          </select>
        </div>

        <div className="mt-3">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-1 text-sm font-semibold"
          >
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}{" "}
            Advanced filters
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium">
                    Start date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border px-3 py-2"
                    value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">End date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border px-3 py-2"
                    value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Topics</label>
                <CreatableSelect
                  isMulti
                  options={topicOptions}
                  value={filters.topics}
                  onChange={(selected) =>
                    updateFilter("topics", selected || [])
                  }
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <span className="font-semibold col-span-full">
                  Target audience:
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.women}
                    onChange={(e) => updateRelevance("women", e.target.checked)}
                  />{" "}
                  Women
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.youth}
                    onChange={(e) => updateRelevance("youth", e.target.checked)}
                  />{" "}
                  Youth
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.farmers}
                    onChange={(e) =>
                      updateRelevance("farmers", e.target.checked)
                    }
                  />{" "}
                  Farmers
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.urban}
                    onChange={(e) => updateRelevance("urban", e.target.checked)}
                  />{" "}
                  Urban
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.rural}
                    onChange={(e) => updateRelevance("rural", e.target.checked)}
                  />{" "}
                  Rural
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.privateSector}
                    onChange={(e) =>
                      updateRelevance("privateSector", e.target.checked)
                    }
                  />{" "}
                  Private sector
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={filters.relevance.government}
                    onChange={(e) =>
                      updateRelevance("government", e.target.checked)
                    }
                  />{" "}
                  Government
                </label>
              </div>
              <div>
                <Button icon={XCircle} onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-5 rounded-lg border bg-white shadow-sm relative">
        {refreshing && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        )}
        {activeTab === "my" &&
          renderPolicyTable(dataPerTab.my, "my", myPage, setMyPage)}
        {activeTab === "delegated" &&
          role === "planner" &&
          renderPolicyTable(
            dataPerTab.delegated,
            "delegated",
            delegatedPage,
            setDelegatedPage,
          )}
        {activeTab === "other" &&
          renderPolicyTable(dataPerTab.other, "other", otherPage, setOtherPage)}
      </div>

      {historyPolicy && (
        <Modal
          title={`History: ${historyPolicy.title}`}
          onClose={() => setHistoryPolicy(null)}
        >
          {historyEvents.length ? (
            <ol className="space-y-3">
              {historyEvents.map((event, idx) => (
                <li key={idx} className="border p-3 rounded">
                  <div className="flex justify-between">
                    <span className="font-bold">{event.action}</span>
                    <span>{formatDate(event.timestamp)}</span>
                  </div>
                  <p className="text-xs uppercase">{event.userRole}</p>
                  {event.details && (
                    <div className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
                      {formatAuditDetails(event)}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No history" description="No audit events." />
          )}
        </Modal>
      )}
    </div>
  );
}
