import { ArrowLeft, Download, FilterX, Info } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsApi } from "../api/analytics";
import { policyApi } from "../api/policies";
import { plannerApi } from "../api/plannerApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import LanguageSelector from "../components/LanguageSelector";
import {
  formatDate,
  formatNumber,
  formatRating,
  getErrorMessage,
} from "../lib/format";
import { useAuth } from "../auth/AuthContext";

const SENTIMENT_COLORS = {
  positive: "#059669",
  negative: "#e11d48",
  neutral: "#64748b",
};

const PAGE_SIZE = 10;

const HelpTooltip = ({ text }) => (
  <span className="group relative ml-1 inline-block cursor-help">
    <Info className="inline h-3.5 w-3.5 text-slate-400" />
    <span className="invisible absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100">
      {text}
      <span className="absolute left-1/2 top-full border-4 border-transparent border-t-slate-800" />
    </span>
  </span>
);

function MetricSelector({ value, onChange, options, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-600">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChartCard({ title, tooltip, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-slate-950">
        {title}
        {tooltip && <HelpTooltip text={tooltip} />}
      </h3>
      {children}
    </section>
  );
}

function Tabs({ tabs, defaultTab, children }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const validChildren = React.Children.toArray(children).filter(
    (child) => child && child.props && child.props.tabId,
  );
  const activeChild = validChildren.find(
    (child) => child.props.tabId === activeTab,
  );
  return (
    <div>
      <div className="border-b border-slate-200">
        <nav className="flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-bold ${
                activeTab === tab.id
                  ? "border-b-2 border-teal-700 text-teal-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-5">{activeChild}</div>
    </div>
  );
}

function TabPane({ children }) {
  return <div>{children}</div>;
}

export function PolicyAnalyticsPage() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [policy, setPolicy] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    sentiment: "",
  });
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [translatedComments, setTranslatedComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [hasExportPermission, setHasExportPermission] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Lazy loaded data
  const [timeseries, setTimeseries] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [timeseriesMetric, setTimeseriesMetric] = useState("");
  const [demographicsMetric, setDemographicsMetric] = useState("primary");
  const [dimension, setDimension] = useState("region");

  // Poll‑type specific metric options
  const getTimeseriesMetricOptions = (pollType) => {
    const base = [];
    if (pollType === "binary")
      base.push({ value: "yesPercentage", label: "Yes %" });
    if (pollType === "rating" || pollType === "likert")
      base.push({ value: "averageRating", label: "Average rating" });
    if (pollType === "approval")
      base.push({ value: "approvePercentage", label: "Approve %" });
    // Always include total votes
    base.push({ value: "totalVotes", label: "Total votes" });
    // Add sentiment if there are comments (we'll check later)
    return base;
  };

  const getDemographicMetricOptions = (pollType, hasSentiment) => {
    const opts = [
      { value: "primary", label: "Primary metric" },
      { value: "totalVotes", label: "Total votes" },
    ];
    if (hasSentiment)
      opts.push({ value: "sentiment", label: "Average sentiment" });
    return opts;
  };

  const allowedAnalyticsStatuses = ["active", "paused", "closed", "archived"];
  const canViewAnalytics =
    policy && allowedAnalyticsStatuses.includes(policy.status);

  // Fetch policy and summary
  useEffect(() => {
    let active = true;
    async function loadOverview() {
      setLoading(true);
      setError("");
      try {
        const policyResult = await policyApi.get(id);
        if (!active) return;
        setPolicy(policyResult);
        setIsOwner(
          policyResult.createdBy?._id === user?.id ||
            policyResult.createdBy === user?.id,
        );
        if (allowedAnalyticsStatuses.includes(policyResult.status)) {
          const params = {
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
          };
          const analyticsResult = await analyticsApi.summary(id, params);
          if (active) setAnalytics(analyticsResult);
        } else {
          if (active) setAnalytics(null);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err, "Failed to load policy"));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOverview();
    return () => {
      active = false;
    };
  }, [id, filters.startDate, filters.endDate, user?.id]);

  // Set initial timeseries metric based on poll type
  useEffect(() => {
    if (policy && analytics) {
      const pollType = policy.pollType;
      let defaultMetric = "";
      if (pollType === "binary") defaultMetric = "yesPercentage";
      else if (pollType === "rating" || pollType === "likert")
        defaultMetric = "averageRating";
      else if (pollType === "approval") defaultMetric = "approvePercentage";
      else defaultMetric = "totalVotes";
      setTimeseriesMetric(defaultMetric);
    }
  }, [policy, analytics]);

  // CSV export is available to admins, policy owners, and accepted associates.
  useEffect(() => {
    let active = true;
    if (!policy || !canViewAnalytics) {
      setHasExportPermission(false);
      return () => {
        active = false;
      };
    }
    if (role === "admin" || isOwner) {
      setHasExportPermission(true);
      return () => {
        active = false;
      };
    }
    if (role !== "planner") {
      setHasExportPermission(false);
      return () => {
        active = false;
      };
    }

    plannerApi
      .getMyAssociatePolicies()
      .then((delegated) => {
        if (!active) return;
        const match = delegated.find((d) => d.policy?._id === id);
        setHasExportPermission(Boolean(match));
      })
      .catch(() => {
        if (active) setHasExportPermission(false);
      });

    return () => {
      active = false;
    };
  }, [policy, canViewAnalytics, role, isOwner, id]);

  // Load detailed data
  useEffect(() => {
    if (!policy || !canViewAnalytics || !analytics) return;
    const params = {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    };
    const loadAllData = async () => {
      try {
        const [
          seriesResult,
          heatmapResult,
          demographicResult,
          correlationResult,
        ] = await Promise.all([
          analyticsApi.timeseries(id, { ...params, bucket: "week" }),
          analyticsApi.heatmap({
            ...params,
            policyId: id,
            interval: "week",
            byRegion: true,
          }),
          analyticsApi.demographics(id, { ...params, dimension }),
          analytics?.pollType === "multipleChoice"
            ? analyticsApi.correlation(id, params)
            : Promise.resolve(null),
        ]);
        setTimeseries(seriesResult);
        setHeatmap(heatmapResult);
        setDemographics(demographicResult);
        setCorrelation(correlationResult);
      } catch (err) {
        console.error("Failed to load analytics data", err);
      }
    };
    loadAllData();
  }, [
    policy,
    analytics,
    canViewAnalytics,
    id,
    filters.startDate,
    filters.endDate,
    dimension,
  ]);

  // Load comments
  useEffect(() => {
    if (!canViewAnalytics) return;
    let active = true;
    async function loadComments() {
      setCommentsLoading(true);
      try {
        const result = await analyticsApi.comments(id, {
          page: commentPage,
          limit: PAGE_SIZE,
          sentiment: filters.sentiment || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        });
        if (!active) return;
        setComments(result.comments || []);
        setCommentTotal(result.total || 0);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load comments"));
      } finally {
        if (active) setCommentsLoading(false);
      }
    }
    loadComments();
    return () => {
      active = false;
    };
  }, [
    canViewAnalytics,
    id,
    commentPage,
    filters.sentiment,
    filters.startDate,
    filters.endDate,
  ]);

  const ratingData = useMemo(() => {
    const distribution =
      analytics?.distribution || analytics?.ratingDistribution || {};
    return [1, 2, 3, 4, 5].map((rating) => ({
      rating: `${rating} star`,
      votes: distribution[rating] || distribution[String(rating)] || 0,
    }));
  }, [analytics]);

  const sentimentData = useMemo(
    () =>
      ["positive", "negative", "neutral"].map((name) => ({
        name,
        value: analytics?.sentimentCounts?.[name] || 0,
      })),
    [analytics],
  );

  const keywordData = analytics?.topKeywords || [];
  const visibleComments = selectedKeyword
    ? comments.filter((comment) => comment.keywords?.includes(selectedKeyword))
    : comments;
  const totalCommentPages = Math.max(1, Math.ceil(commentTotal / PAGE_SIZE));

  const handleCommentTranslation = (commentId, translatedText) => {
    setTranslatedComments((current) => ({
      ...current,
      [commentId]: translatedText,
    }));
  };

  const revertCommentTranslation = (commentId) => {
    setTranslatedComments((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  };

  const updateFilter = (name, value) => {
    setCommentPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const downloadCsv = async () => {
    if (!hasExportPermission) return;
    setExporting(true);
    setError("");
    try {
      const blob = await analyticsApi.exportCsv(id, {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `policy-${id}-analytics.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to export CSV"));
    } finally {
      setExporting(false);
    }
  };

  // Helper to get primary metric value from analytics summary
  const getPrimaryMetricValue = () => {
    if (!analytics) return 0;
    const pollType = analytics.pollType;
    if (pollType === "binary") return analytics.yesPercentage || 0;
    if (pollType === "rating" || pollType === "likert")
      return analytics.average || 0;
    if (pollType === "approval") return analytics.approvePercentage || 0;
    return 0;
  };

  const getPrimaryMetricLabel = () => {
    if (!analytics) return "Metric";
    const pollType = analytics.pollType;
    if (pollType === "binary") return "Yes %";
    if (pollType === "rating" || pollType === "likert") return "Average rating";
    if (pollType === "approval") return "Approve %";
    return "Primary metric";
  };

  // Timeseries helpers
  const timeseriesData = timeseries?.data || [];
  const getTimeseriesValue = (item) => {
    if (timeseriesMetric === "totalVotes") return item.totalVotes;
    if (timeseriesMetric === "averageRating") return item.averageRating || 0;
    if (timeseriesMetric === "yesPercentage") return item.yesPercentage || 0;
    if (timeseriesMetric === "approvePercentage")
      return item.approvePercentage || 0;
    if (timeseriesMetric === "averageSentiment")
      return item.averageSentiment || 0;
    return 0;
  };
  const timeseriesChartData = timeseriesData.map((item) => ({
    bucket: item.bucket,
    value: getTimeseriesValue(item),
  }));

  // Heatmap helpers
  const heatmapData = heatmap?.data || [];
  const getHeatmapMetric = (row) => {
    let value;
    if (analytics?.pollType === "binary") value = row.yesPercentage;
    else if (
      analytics?.pollType === "rating" ||
      analytics?.pollType === "likert"
    )
      value = row.averageRating;
    else if (analytics?.pollType === "approval") value = row.approvePercentage;
    else if (analytics?.pollType === "multipleChoice")
      value = row.topOptionPercentage;
    else if (analytics?.pollType === "rankedChoice")
      value = row.topFirstChoicePercentage;
    else value = row.totalVotes;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };
  const maxHeatmapValue = Math.max(
    ...heatmapData.map((row) => getHeatmapMetric(row) || 0),
    1,
  );
  const getHeatmapColor = (value) => {
    if (!value) return "#f1f5f9";
    const intensity = value / maxHeatmapValue;
    const r = 15 + (1 - intensity) * 100;
    const g = 118 + (1 - intensity) * 50;
    const b = 110 + (1 - intensity) * 50;
    return `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;
  };

  // Demographics helpers
  const demographicData = demographics?.data || [];
  const getDemographicMetric = (item) => {
    if (demographicsMetric === "primary") {
      if (analytics?.pollType === "binary") return item.yesPercentage;
      if (analytics?.pollType === "rating" || analytics?.pollType === "likert")
        return item.averageRating;
      if (analytics?.pollType === "approval") return item.approvePercentage;
      return item.totalVotes;
    }
    if (demographicsMetric === "sentiment") return item.averageSentiment;
    return item.totalVotes;
  };
  const hasSentiment =
    analytics &&
    analytics.sentimentCounts?.positive +
      analytics.sentimentCounts?.negative +
      analytics.sentimentCounts?.neutral >
      0;
  // Build timeseries options
  let timeseriesOptions = policy
    ? getTimeseriesMetricOptions(policy.pollType)
    : [];
  if (hasSentiment) {
    timeseriesOptions.push({
      value: "averageSentiment",
      label: "Average sentiment",
    });
  }
  const demographicOptions = analytics
    ? getDemographicMetricOptions(
        policy.pollType,
        analytics.sentimentCounts?.positive +
          analytics.sentimentCounts?.negative +
          analytics.sentimentCounts?.neutral >
          0,
      )
    : [];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "trends", label: "Trends" },
    { id: "geography", label: "Geography" },
    { id: "demographics", label: "Demographics" },
    ...(analytics?.pollType === "multipleChoice"
      ? [{ id: "correlation", label: "Correlation" }]
      : []),
    {
      id: "comments",
      label: filters.sentiment ? `Comments (${commentTotal})` : "Comments",
    },
  ];

  if (loading) return <LoadingState label="Loading analytics" />;

  return (
    <div>
      <PageHeader
        title={policy?.title || analytics?.title || "Policy analytics"}
        description={
          policy
            ? `${policy.policyCode} • ${policy.targetRegions?.join(", ")} • ${formatDate(policy.startDate)} to ${formatDate(policy.endDate)}`
            : ""
        }
        actions={
          <>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              to="/policies"
            >
              <ArrowLeft className="h-4 w-4" />
              Policies
            </Link>
            {canViewAnalytics && hasExportPermission && (
              <button
                type="button"
                disabled={exporting}
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            )}
          </>
        }
      />

      <div className="space-y-3">
        <ErrorAlert message={error} />
        {policy ? <StatusBadge status={policy.status} /> : null}
      </div>

      {!canViewAnalytics ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center text-amber-700">
          Analytics are not available for policies with status{" "}
          <strong>{policy?.status}</strong>.
          {policy?.status === "draft" &&
            " Please publish the policy to make it active."}
          {policy?.status === "published" &&
            " The policy will become active on its start date."}
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  updateFilter("startDate", event.target.value)
                }
                aria-label="Start date"
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  updateFilter("endDate", event.target.value)
                }
                aria-label="End date"
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                value={filters.sentiment}
                onChange={(event) =>
                  updateFilter("sentiment", event.target.value)
                }
              >
                <option value="">All sentiments</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          </section>

          <div className="mt-5">
            <Tabs tabs={tabs} defaultTab="overview">
              {/* Overview Tab */}
              <TabPane tabId="overview">
                {analytics && (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricCard
                        label={getPrimaryMetricLabel()}
                        value={formatRating(getPrimaryMetricValue())}
                        helper={analytics.pollType}
                      />
                      <MetricCard
                        label="Total votes"
                        value={formatNumber(analytics.totalVotes)}
                        helper="Across selected filters"
                      />
                      <MetricCard
                        label="Comments analyzed"
                        value={formatNumber(
                          sentimentData.reduce(
                            (sum, item) => sum + item.value,
                            0,
                          ),
                        )}
                        helper="Sentiment‑tagged comments"
                      />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      {/* Rating distribution */}
                      {["rating", "likert"].includes(analytics.pollType) && (
                        <ChartCard
                          title="Rating distribution"
                          tooltip="Number of votes per star rating"
                        >
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={ratingData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="rating" />
                              <YAxis allowDecimals={false} />
                              <RechartsTooltip />
                              <Bar
                                dataKey="votes"
                                fill="#0f766e"
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      )}

                      {/* Binary result */}
                      {analytics.pollType === "binary" && (
                        <ChartCard
                          title="Binary result"
                          tooltip="Yes/No breakdown"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <MetricCard
                              label="Yes"
                              value={formatNumber(analytics.yesCount)}
                              helper={`${analytics.yesPercentage}%`}
                            />
                            <MetricCard
                              label="No"
                              value={formatNumber(analytics.noCount)}
                              helper={`${analytics.noPercentage}%`}
                            />
                          </div>
                        </ChartCard>
                      )}

                      {/* Approval result */}
                      {analytics.pollType === "approval" && (
                        <ChartCard
                          title="Approval result"
                          tooltip="Approve/Reject/Abstain"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <MetricCard
                              label="Approve"
                              value={formatNumber(analytics.approveCount)}
                              helper={`${analytics.approvePercentage}%`}
                            />
                            <MetricCard
                              label="Reject"
                              value={formatNumber(analytics.rejectCount)}
                              helper={`${analytics.rejectPercentage}%`}
                            />
                            <MetricCard
                              label="Abstain"
                              value={formatNumber(analytics.abstainCount)}
                              helper={`${analytics.abstainPercentage}%`}
                            />
                            <MetricCard
                              label="Net approval"
                              value={formatNumber(analytics.netApproval)}
                            />
                          </div>
                        </ChartCard>
                      )}

                      {/* Option results (multipleChoice or rankedChoice) */}
                      {(analytics.pollType === "multipleChoice" ||
                        analytics.pollType === "rankedChoice") && (
                        <ChartCard
                          title={
                            analytics.pollType === "rankedChoice"
                              ? "First‑choice results"
                              : "Option results"
                          }
                          tooltip="Counts per option"
                        >
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                              data={
                                analytics.results?.map((item) => ({
                                  name: item.text,
                                  votes: item.count,
                                })) ||
                                analytics.firstChoiceResults?.map((item) => ({
                                  name: item.text,
                                  votes: item.firstChoiceCount,
                                })) ||
                                []
                              }
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <RechartsTooltip />
                              <Bar
                                dataKey="votes"
                                fill="#0f766e"
                                radius={[6, 6, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      )}

                      {/* Sentiment pie */}
                      <ChartCard
                        title="Sentiment"
                        tooltip="Sentiment distribution from comments"
                      >
                        {sentimentData.some((item) => item.value > 0) ? (
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={sentimentData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={62}
                                outerRadius={96}
                                paddingAngle={2}
                              >
                                {sentimentData.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={SENTIMENT_COLORS[entry.name]}
                                  />
                                ))}
                              </Pie>
                              <RechartsTooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyState
                            title="No sentiment yet"
                            description="Comments will appear here after AI processing completes."
                          />
                        )}
                      </ChartCard>

                      {/* Keywords */}
                      <ChartCard
                        title="Keywords"
                        tooltip="Most frequent keywords extracted from comments"
                      >
                        {keywordData.length ? (
                          <div className="space-y-2">
                            {keywordData.map((item) => (
                              <button
                                key={item.keyword}
                                type="button"
                                onClick={() =>
                                  setSelectedKeyword((current) =>
                                    current === item.keyword
                                      ? ""
                                      : item.keyword,
                                  )
                                }
                                className={[
                                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm",
                                  selectedKeyword === item.keyword
                                    ? "border-teal-500 bg-teal-50 text-teal-900"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                ].join(" ")}
                              >
                                <span className="truncate font-semibold">
                                  {item.keyword}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                                  {item.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            title="No keywords yet"
                            description="Keyword extraction results will appear after comments are processed."
                          />
                        )}
                      </ChartCard>
                    </div>
                  </div>
                )}
              </TabPane>

              {/* Trends Tab */}
              <TabPane tabId="trends">
                <ChartCard
                  title="Timeseries"
                  tooltip="Votes, rating, or sentiment over time"
                >
                  <div className="mb-4 flex justify-end">
                    {timeseriesOptions.length > 0 && (
                      <MetricSelector
                        value={timeseriesMetric}
                        onChange={setTimeseriesMetric}
                        options={timeseriesOptions}
                        label="Metric"
                      />
                    )}
                  </div>
                  {timeseriesData.length ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={timeseriesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" />
                        <YAxis />
                        <RechartsTooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No timeseries data"
                      description="Votes over time will appear here."
                    />
                  )}
                </ChartCard>
              </TabPane>

              {/* Geography Tab */}
              <TabPane tabId="geography">
                <ChartCard
                  title="Heatmap by region"
                  tooltip="Geographic distribution of votes and sentiment (colour intensity indicates metric value)"
                >
                  {heatmapData.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Period</th>
                            <th className="px-3 py-2">Region</th>
                            <th className="px-3 py-2">Metric</th>
                            <th className="px-3 py-2">Sentiment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {heatmapData.map((item, idx) => {
                            const metricValue = getHeatmapMetric(item);
                            const bgColor = getHeatmapColor(metricValue);
                            return (
                              <tr key={`${item.period}-${item.region}-${idx}`}>
                                <td className="px-3 py-2">{item.period}</td>
                                <td className="px-3 py-2">
                                  {item.region || "All"}
                                </td>
                                <td
                                  className="px-3 py-2"
                                  style={{ backgroundColor: bgColor }}
                                >
                                  {metricValue?.toFixed(1)}%
                                </td>
                                <td className="px-3 py-2">
                                  {item.averageSentiment?.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="No heatmap data"
                      description="Regional vote buckets will appear here."
                    />
                  )}
                </ChartCard>
              </TabPane>

              {/* Demographics Tab */}
              <TabPane tabId="demographics">
                <ChartCard
                  title="Demographic breakdown"
                  tooltip="Vote distribution across demographic groups"
                >
                  <div className="mb-4 flex flex-wrap gap-4">
                    <select
                      value={dimension}
                      onChange={(e) => setDimension(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
                    >
                      <option value="region">Region</option>
                      <option value="ageRange">Age range</option>
                      <option value="gender">Gender</option>
                      <option value="occupation">Occupation</option>
                      <option value="education">Education</option>
                    </select>
                    <MetricSelector
                      value={demographicsMetric}
                      onChange={setDemographicsMetric}
                      options={demographicOptions}
                      label="Metric"
                    />
                  </div>
                  {demographicData.length ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={demographicData.map((item) => ({
                          name: item[dimension],
                          value: getDemographicMetric(item),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar
                          dataKey="value"
                          fill="#0f766e"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No demographic data"
                      description="Breakdowns appear after matching votes are available."
                    />
                  )}
                </ChartCard>
              </TabPane>

              {/* Correlation Tab */}
              {analytics?.pollType === "multipleChoice" && (
                <TabPane tabId="correlation">
                  <ChartCard
                    title="Option correlation"
                    tooltip="How often options are chosen together (co‑occurrence matrix)"
                  >
                    {correlation?.correlations?.length ? (
                      <div className="space-y-2">
                        {correlation.correlations.map((item) => (
                          <div
                            key={`${item.optionA}-${item.optionB}`}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="font-bold">{item.optionA}</span>{" "}
                            with{" "}
                            <span className="font-bold">{item.optionB}</span>:{" "}
                            {item.coOccurrenceCount} ({item.percentage}%)
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No correlation data"
                        description="Sufficient data will appear here."
                      />
                    )}
                  </ChartCard>
                </TabPane>
              )}

              {/* Comments Tab */}
              <TabPane tabId="comments">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        Comments
                      </h3>
                      <p className="text-sm text-slate-500">
                        {selectedKeyword
                          ? `Filtered by keyword "${selectedKeyword}"`
                          : filters.sentiment
                            ? `Showing ${filters.sentiment} comments.`
                          : "Raw citizen comments with sentiment and keywords."}
                      </p>
                    </div>
                    {selectedKeyword && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        onClick={() => setSelectedKeyword("")}
                      >
                        <FilterX className="h-4 w-4" />
                        Clear keyword
                      </button>
                    )}
                  </div>

                  {commentsLoading ? (
                    <LoadingState label="Loading comments" />
                  ) : visibleComments.length ? (
                    <div className="space-y-3">
                      {visibleComments.map((comment) => (
                        <article
                          key={comment.id}
                          className="rounded-lg border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-xs font-bold capitalize",
                                comment.sentiment === "positive"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : comment.sentiment === "negative"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-slate-100 text-slate-700",
                              ].join(" ")}
                            >
                              {comment.sentiment || "pending"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {translatedComments[comment.id] || comment.text}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <LanguageSelector
                              text={comment.text}
                              onTranslated={(translatedText) =>
                                handleCommentTranslation(
                                  comment.id,
                                  translatedText,
                                )
                              }
                            />
                            {translatedComments[comment.id] && (
                              <button
                                type="button"
                                onClick={() => revertCommentTranslation(comment.id)}
                                className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Show original
                              </button>
                            )}
                          </div>
                          {comment.keywords?.length && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {comment.keywords.map((keyword) => (
                                <button
                                  key={keyword}
                                  type="button"
                                  onClick={() => setSelectedKeyword(keyword)}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                                >
                                  {keyword}
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No comments found"
                      description="Try changing the sentiment, date, or keyword filters."
                    />
                  )}

                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <span>
                      Page {commentPage} of {totalCommentPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={commentPage <= 1}
                        onClick={() =>
                          setCommentPage((c) => Math.max(1, c - 1))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={commentPage >= totalCommentPages}
                        onClick={() => setCommentPage((c) => c + 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </section>
              </TabPane>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
}
