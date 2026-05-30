import { CalendarClock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { adminApi } from "../api/admin";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { MetricCard } from "../components/MetricCard";
import {
  getErrorMessage,
  toIsoFromDateInput,
  toDateInput,
} from "../lib/format";

export function TrendsDashboardPage() {
  const [searchParams] = useSearchParams();
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interval, setInterval] = useState(searchParams.get("interval") || "day");
  const [dates, setDates] = useState(() => ({
    startDate: searchParams.get("startDate") || toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: searchParams.get("endDate") || toDateInput(new Date()),
  }));

  const loadTrends = async (nextInterval = interval, nextDates = dates) => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.getTrends({
        interval: nextInterval,
          startDate: nextDates.startDate
            ? toIsoFromDateInput(nextDates.startDate)
          : undefined,
        endDate: nextDates.endDate
            ? toIsoFromDateInput(nextDates.endDate, true)
          : undefined,
      });
      setTrends(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load trends"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const nextInterval = searchParams.get("interval") || "day";
    const nextStartDate = searchParams.get("startDate");
    const nextEndDate = searchParams.get("endDate");

    setInterval(nextInterval);
    const nextDates = {
      startDate:
        nextStartDate || toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      endDate: nextEndDate || toDateInput(new Date()),
    };
    setDates(nextDates);
    loadTrends(nextInterval, nextDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDateChange = (field, value) => {
    setDates((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilter = () => {
    loadTrends();
  };

  const trendData = trends?.data || [];
  const totalVotes = trends?.totalVotes || 0;
  const totalNewUsers = trends?.newUsers || 0;

  if (loading) return <LoadingState label="Loading trends" />;

  return (
    <div>
      <PageHeader
        title="Trends & Analytics"
        description="View voting and user registration trends over time across all policies."
      />

      <div className="space-y-5">
        <ErrorAlert message={error} />

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-teal-700" />
              <div>
                <h3 className="text-lg font-black text-slate-950">Trend Filters</h3>
                <p className="text-sm text-slate-500">
                  Refine the timeline and compare engagement patterns.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Daily</span>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-100"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Start Date
                </span>
                <input
                  type="date"
                  value={dates.startDate}
                  onChange={(e) => handleDateChange("startDate", e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  End Date
                </span>
                <input
                  type="date"
                  value={dates.endDate}
                  onChange={(e) => handleDateChange("endDate", e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={handleApplyFilter}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 hover:shadow-md"
              >
                <RefreshCw className="h-4 w-4" />
                Apply Filter
              </button>
            </div>
          </div>
        </section>

        {trends && (
          <div className="space-y-5">
            {/* Summary Metrics */}
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Total Votes" value={totalVotes} />
              <MetricCard label="New Users" value={totalNewUsers} />
            </div>

            {trendData.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-8 py-12 text-center">
                <p className="text-slate-600">
                  No trends data found for the selected date range.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">
                  Votes & New Users Over Time
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="votes"
                      stroke="#0d9488"
                      strokeWidth={2}
                      name="Votes"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="newUsers"
                      stroke="#2563eb"
                      strokeWidth={2}
                      name="New Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
