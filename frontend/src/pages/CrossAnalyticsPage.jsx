import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { analyticsApi } from "../api/analytics";
import { ETHIOPIAN_REGIONS, POLICY_TOPICS } from "../constants/regions";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState"; // <-- added
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { formatNumber, getErrorMessage } from "../lib/format";
import { useDebounce } from "../hooks/useDebounce";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["male", "female", "prefer-not-to-say"]; // removed non-binary
const OCCUPATIONS = [
  "student",
  "farmer",
  "merchant",
  "government-employee",
  "private-sector",
  "unemployed",
  "other",
];
const EDUCATIONS = [
  "no-formal",
  "primary",
  "secondary",
  "diploma",
  "bachelors",
  "postgraduate",
];

export function CrossAnalyticsPage() {
  const [filters, setFilters] = useState({
    topics: "",
    region: "",
    gender: "",
    ageRange: "",
    occupation: "",
    education: "",
    startDate: "",
    endDate: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const debouncedFilters = useDebounce(filters, 500);

  async function loadAnalytics(filterValues, isInitial = false) {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const result = await analyticsApi.cross({
        topics: filterValues.topics || undefined,
        region: filterValues.region || undefined,
        gender: filterValues.gender || undefined,
        ageRange: filterValues.ageRange || undefined,
        occupation: filterValues.occupation || undefined,
        education: filterValues.education || undefined,
        startDate: filterValues.startDate || undefined,
        endDate: filterValues.endDate
          ? `${filterValues.endDate}T23:59:59.000Z`
          : undefined,
      });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load cross-policy analytics"));
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalytics(debouncedFilters, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only initial load

  useEffect(() => {
    if (debouncedFilters.topics !== undefined) {
      // skip initial call because it already loaded
      loadAnalytics(debouncedFilters, false);
    }
  }, [debouncedFilters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const sentimentData = ["positive", "negative", "neutral"].map((name) => ({
    name,
    count: data?.sentimentCounts?.[name] || 0,
  }));

  const sentimentColors = {
    positive: "#10b981",
    negative: "#ef4444",
    neutral: "#64748b",
  };

  if (loading) return <LoadingState label="Loading cross analytics" />;

  return (
    <div>
      <PageHeader
        title="Cross Analytics"
        description="Compare engagement, sentiment, and keywords across the policies you own. Apply demographic filters to narrow the analysis."
      />
      <ErrorAlert message={error} />

      {/* Filters – auto‑apply on change */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            list="topic-options"
            value={filters.topics}
            onChange={(e) => handleFilterChange("topics", e.target.value)}
            placeholder="Topics (comma separated)"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          />
          <datalist id="topic-options">
            {POLICY_TOPICS.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>

          <select
            value={filters.region}
            onChange={(e) => handleFilterChange("region", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All regions</option>
            {ETHIOPIAN_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select
            value={filters.gender}
            onChange={(e) => handleFilterChange("gender", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All genders</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={filters.ageRange}
            onChange={(e) => handleFilterChange("ageRange", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All ages</option>
            {AGE_RANGES.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>

          <select
            value={filters.occupation}
            onChange={(e) => handleFilterChange("occupation", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All occupations</option>
            {OCCUPATIONS.map((occ) => (
              <option key={occ} value={occ}>
                {occ.replace("-", " ")}
              </option>
            ))}
          </select>

          <select
            value={filters.education}
            onChange={(e) => handleFilterChange("education", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
          >
            <option value="">All education levels</option>
            {EDUCATIONS.map((edu) => (
              <option key={edu} value={edu}>
                {edu.replace("-", " ")}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            placeholder="Start date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            placeholder="End date"
          />
        </div>
      </section>

      <div className="mt-5 relative">
        {refreshing && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        )}
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Total votes"
                value={formatNumber(data.totalVotes)}
              />
              <MetricCard
                label="Total comments"
                value={formatNumber(data.totalComments)}
              />
              <MetricCard
                label="Policies included"
                value={formatNumber(data.policyCount || 0)}
              />
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-950">
                Sentiment
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sentimentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {sentimentData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={sentimentColors[entry.name] || "#0f766e"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">
                      Top Keywords
                    </h3>
                    <p className="text-sm text-slate-500">
                      Ranked by how often they appear in the current selection.
                    </p>
                  </div>
                  {data.topKeywords?.length ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      {data.topKeywords.length} terms analyzed
                    </span>
                  ) : null}
                </div>
              </div>

              {data.topKeywords?.length ? (
                <div className="space-y-3 p-5">
                  {data.topKeywords.slice(0, 10).map((item, index) => {
                      const maxCount = data.topKeywords?.[0]?.count || 1;
                      const width = Math.max(8, Math.round((item.count / maxCount) * 100));
                      const isTopThree = index < 3;

                      return (
                        <div
                          key={item.keyword}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${
                                  index === 0
                                    ? "bg-emerald-600 text-white"
                                    : index === 1
                                      ? "bg-teal-600 text-white"
                                      : index === 2
                                        ? "bg-cyan-600 text-white"
                                        : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                #{index + 1}
                              </div>
                              <div>
                                <p className="text-base font-bold text-slate-950">
                                  {item.keyword}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {isTopThree ? "High-frequency term" : "Supporting keyword"}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                              {item.count}
                            </span>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${
                                index === 0
                                  ? "bg-gradient-to-r from-emerald-600 to-lime-500"
                                  : index === 1
                                    ? "bg-gradient-to-r from-teal-600 to-emerald-500"
                                    : index === 2
                                      ? "bg-gradient-to-r from-cyan-600 to-teal-500"
                                      : "bg-gradient-to-r from-slate-500 to-slate-400"
                              }`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No keywords found"
                    description="Try a broader filter."
                  />
                </div>
              )}
            </section>
          </div>
        ) : (
          <EmptyState
            title="No cross-policy data"
            description="Try adjusting the filters."
          />
        )}
      </div>
    </div>
  );
}
