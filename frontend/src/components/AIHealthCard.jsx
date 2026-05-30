import { AlertCircle, CheckCircle, Server } from "lucide-react";
import { useState, useEffect } from "react";
import { adminApi } from "../api/admin";

export function AIHealthCard() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const result = await adminApi.getAIHealth();
        setHealth(result);
      } catch {
        setError("Unable to fetch AI service status");
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();

    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === "ok";
  const statusColor = isHealthy ? "text-emerald-700" : "text-rose-700";
  const bgColor = isHealthy ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200";

  return (
    <article className={`rounded-lg border ${bgColor} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">AI Service Status</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {loading ? "..." : isHealthy ? "Online" : "Offline"}
          </p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${statusColor}`}>
          {loading ? <Server className="h-5 w-5 opacity-50" /> : isHealthy ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
        </span>
      </div>
      {!loading && error && (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      )}
      {!loading && health && !isHealthy && (
        <p className="mt-3 text-sm text-rose-600">{health.error || "Service unreachable"}</p>
      )}
    </article>
  );
}
