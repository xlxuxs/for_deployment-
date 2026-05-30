import {
  Activity,
  ArrowUpRight,
  BarChart3,
  File,
  FileText,
  PlayCircle,
  Sparkles,
  Vote,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { adminApi } from "../api/admin";
import { policyApi } from "../api/policies";
import { useAuth } from "../auth/AuthContext";
import { CommentModerationPage } from "./CommentModerationPage";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";
import {
  formatDate,
  formatNumber,
  getErrorMessage,
} from "../lib/format";

function formatRelativeTime(value) {
  if (!value) return "just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes === 0
      ? "just now"
      : `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) === 1 ? "" : "s"} ago`;
  }

  if (Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ago`;
  }

  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`;
}

function buildTrendsLink(date) {
  const params = new URLSearchParams({
    interval: "day",
    startDate: date,
    endDate: date,
  });

  return `/trends?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────
// Reusable Sub-Components (extracted for clarity & reusability)
// ─────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  href,
  color = "emerald",
}) => {
  const { t } = useI18n();
  const colorClasses = {
    emerald: "bg-emerald-50 border-emerald-200",
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    violet: "bg-violet-50 border-violet-200",
  };

  const iconColors = {
    emerald: "text-emerald-600 bg-emerald-100",
    blue: "text-blue-600 bg-blue-100",
    amber: "text-amber-600 bg-amber-100",
    violet: "text-violet-600 bg-violet-100",
  };

  const Content = (
    <div className={`relative overflow-hidden rounded-2xl border ${colorClasses[color]} p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-600">{t(label)}</p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          {subtext && <p className="text-xs text-slate-500">{t(subtext)}</p>}
          {trend && (
            <div className={`inline-flex items-center gap-1 text-xs font-medium ${trend.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% {t("vs last period")}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${iconColors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {/* Decorative background element */}
      <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-white/30 blur-xl" />
    </div>
  );

  return href ? (
    <Link to={href} className="block">{Content}</Link>
  ) : Content;
};

const TrendChart = ({ data }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-slate-900 mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="date" 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#64748b' }}
          interval="preserveStartEnd"
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#64748b' }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="votes"
          stroke="#0f766e"
          strokeWidth={2.5}
          fill="#0f766e"
          name="Votes"
          dot={false}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="newUsers"
          stroke="#2563eb"
          strokeWidth={2.5}
          fill="#2563eb"
          name="New users"
          dot={false}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const PolicyListItem = ({ policy }) => {
  const { t } = useI18n();

  return (
    <Link
      to={`/policies/${policy.id}`}
      className="policy-list-item group grid gap-3 rounded-xl px-3 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      <div>
        <div className="flex items-center gap-2">
          <p className="policy-list-item__title font-semibold text-slate-900 transition-colors">
            {policy.title}
          </p>
          {policy.isPriority && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {t("Priority")}
            </span>
          )}
        </div>
        <p className="policy-list-item__meta mt-1 text-sm text-slate-500">
          {policy.policyCode} • {policy.targetRegions?.slice(0, 2).map((region) => t(region)).join(", ")}
          {policy.targetRegions?.length > 2 && ` +${policy.targetRegions.length - 2}`}
        </p>
      </div>
      <div className="flex items-center">
        <StatusBadge status={policy.status} size="sm" />
      </div>
      <div className="policy-list-item__time flex items-center gap-1 text-sm text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        <span>{t(formatRelativeTime(policy.startDate))}</span>
      </div>
    </Link>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useI18n();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminStats, setAdminStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (role === "comment_moderator") {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        if (role === "admin") {
          const [stats, trendResult] = await Promise.all([
            adminApi.dashboardStats(),
            adminApi.getTrends({ interval: "day", days: 30 }),
          ]);
          if (active) {
            setAdminStats(stats);
            setTrends(trendResult.data || []);
          }
        }

        const policyResult = await policyApi.list({
          owner: role === "planner" ? "me" : undefined,
          limit: 100,
        });
        if (active) setPolicies(policyResult.policies || []);
        
        if (active) setLastUpdated(new Date());
      } catch (err) {
        if (active)
          setError(getErrorMessage(err, "Failed to load dashboard data"));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => { active = false; };
  }, [role]);

  // Memoized calculations for performance
  const policyMetrics = useMemo(() => {
    const draftCount = policies.filter(p => p.status === "draft").length;
    const activeCount = policies.filter(p => p.status === "active").length;
    const publishedCount = policies.filter(p => p.status === "published").length;
    const closedCount = policies.filter(p => p.status === "closed").length;
    const uniqueRegions = new Set(
      policies.flatMap((policy) => policy.targetRegions || [])
    ).size;
    
    return { draftCount, activeCount, publishedCount, closedCount, uniqueRegions, total: policies.length };
  }, [policies]);

  if (role === "comment_moderator") {
    return <CommentModerationPage />;
  }

  if (loading) return <LoadingState label="Loading your dashboard" />;

  const stats = adminStats || {};

  const quickActions = [
    { to: "/policies/new", label: "Create Policy", icon: FileText, primary: true },
    { to: "/analytics/cross", label: "Analytics", icon: BarChart3 },
    ...(role === "admin"
      ? [
          { to: "/planners?create=true", label: "Create Planner", icon: Users },
          { to: "/comments/pending", label: "Moderate", icon: AlertCircle },
        ]
      : [{ to: "/policies", label: "My Policies", icon: FileText }]),
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                Welcome back, {user?.name?.split(' ')[0] || 'Team'}
                <Sparkles className="h-4 w-4 text-amber-500" />
              </span>
            }
            description={t("Track policy performance, engagement metrics, and civic participation at a glance.")}
          />
          {lastUpdated && (
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("Updated")} {t(formatRelativeTime(lastUpdated))}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                action.primary
                  ? "bg-teal-700 text-white shadow-md hover:bg-teal-800 hover:shadow-lg"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-teal-300 hover:text-teal-700 shadow-sm"
              }`}
            >
              {action.icon && <action.icon className="h-4 w-4" />}
              {t(action.label)}
            </Link>
          ))}
        </div>
      </div>

      

      <ErrorAlert message={error} />

      {/* Hero Stats Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-slate-700/20 blur-3xl" />
        
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-white/20 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Live Dashboard")}
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {role === "admin"
                ? t("Oversee policy activity, moderation workflows, and platform health")
                : t("Monitor your policies' performance and citizen engagement")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">
              {t("Your centralized command center for civic policy management. Make data-driven decisions with real-time insights.")}
            </p>
          </div>

          {/* Mini Stats */}
          <div className="grid grid-cols-3 gap-3 lg:w-[420px]">
            {[
              { label: "Regions", value: policyMetrics.uniqueRegions, sub: "active" },
              { label: "Live", value: policyMetrics.activeCount, sub: "policies" },
              { label: "Engaged", value: formatNumber(stats.votes?.total || 0), sub: "votes" },
            ].map((stat) => (
              <div 
                key={stat.label}
                className="rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/15"
              >
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-xs font-medium text-emerald-100/80">
                  {t(stat.label)}
                </p>
                <p className="text-[10px] text-emerald-100/60">{t(stat.sub)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin Quick Actions */}
      {role === "admin" && (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Pending Reviews",
              value: formatNumber(stats.comments?.pendingReview || 0),
              to: "/comments/pending",
              icon: AlertCircle,
              color: "amber",
              subtext: "Comments awaiting moderation"
            },
            {
              label: "Active Planners",
              value: formatNumber(stats.planners?.active || 0),
              to: "/planners",
              icon: Users,
              color: "blue",
              subtext: "Currently contributing"
            },
            {
              label: "Policies Live",
              value: formatNumber(stats.policies?.active || 0),
              to: "/policies?status=active",
              icon: CheckCircle2,
              color: "emerald",
              subtext: "Open for public voting"
            },
          ].map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              subtext={item.subtext}
              icon={item.icon}
              href={item.to}
              color={item.color}
            />
          ))}
        </section>
      )}

      {/* Core Metrics Grid */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={role === "admin" ? "Total Policies" : "My Policies"}
          value={formatNumber(policyMetrics.total)}
          subtext={role === "admin" ? "Platform-wide" : "Created by you"}
          icon={FileText}
          color="violet"
        />
        <StatCard
          label="In Progress"
          value={formatNumber(policyMetrics.draftCount)}
          subtext="Draft & review stage"
          icon={File}
          color="amber"
        />
        <StatCard
          label="Active for Voting"
          value={formatNumber(policyMetrics.activeCount)}
          subtext="Citizens can participate"
          icon={PlayCircle}
          color="emerald"
        />
      </section>

      {/* Secondary Metrics Row */}
      <div className={`grid gap-4 ${role === "admin" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {role === "admin" ? (
          <>
            <StatCard
              label="Total Votes Cast"
              value={formatNumber(stats.votes?.total || 0)}
              subtext={`${formatNumber(stats.votes?.app || 0)} app • ${formatNumber(stats.votes?.sms || 0)} SMS`}
              icon={Vote}
              color="blue"
            />
            <StatCard
              label="Avg. Engagement"
              value={`${stats.engagement?.avgVotesPerPolicy || 0}`}
              subtext="Votes per active policy"
              icon={BarChart3}
              color="emerald"
              trend={{ value: 12, isPositive: true }}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Published"
              value={policyMetrics.publishedCount}
              subtext="Live & collecting feedback"
              icon={CheckCircle2}
              color="emerald"
            />
            <StatCard
              label="Completed"
              value={policyMetrics.closedCount}
              subtext="Voting period ended"
              icon={Clock}
              color="blue"
            />
            <StatCard
              label="Regions Reached"
              value={policyMetrics.uniqueRegions}
              subtext="Geographic coverage"
              icon={Activity}
              color="violet"
            />
          </>
        )}
      </div>

      {/* Activity Trends */}
      {role === "admin" && trends.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Activity Trends</h3>
              <p className="text-sm text-slate-500">Votes and new users over the last 30 days</p>
            </div>
            <Link
              to="/trends"
              className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Full report <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <TrendChart data={trends} />
        </section>
      )}

      {/* Recent Policies */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {role === "admin" ? "Recent Policies" : "Your Recent Policies"}
            </h3>
            <p className="text-sm text-slate-500">
              {policies.length} total • Showing latest 6
            </p>
          </div>
          <Link
            to="/policies"
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            View all <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        
        {policies.length === 0 ? (
          <EmptyState
            title={role === "admin" ? "No policies yet" : "You haven't created any policies"}
            description={role === "admin" 
              ? "Policies will appear here once planners start creating them." 
              : "Start by creating your first policy to engage your community."}
            action={role === "planner" ? { label: "Create Policy", to: "/policies/new" } : undefined}
            icon={FileText}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {policies.slice(0, 6).map((policy) => (
              <PolicyListItem key={policy.id} policy={policy} />
            ))}
          </div>
        )}
      </section>

      {/* Footer Note */}
      <div className="text-center text-xs text-slate-400">
        Dashboard refreshes automatically • Last sync: {lastUpdated?.toLocaleTimeString()}
      </div>
    </div>
  );
}
