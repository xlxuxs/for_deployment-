import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io as socketIOClient } from "socket.io-client";
import { showToast } from "../lib/toast";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/client";
import { userApi } from "../api/user";
import { readStoredAuth } from "../lib/storage";
import { EmptyState } from "../components/EmptyState";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const observerRef = useRef(null);

  async function loadNotifications() {
    setError("");
    try {
      const result = await userApi.getNotifications({ limit: 100 });
      setNotifications(result.notifications || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const userId = readStoredAuth()?.userId;
    if (!userId) return;

    try {
      const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
      const socket = socketIOClient(apiOrigin, {
        auth: { userId },
        transports: ["websocket"],
        withCredentials: true,
      });

      socket.on("connect", () => {
        // for debugging during development
        console.debug("notifications socket connected", socket.id);
      });

      socket.on("notification", (payload) => {
        // When a notification arrives, refresh list and show a toast
        try {
          loadNotifications();
          if (payload && payload.title) {
            showToast("info", payload.title + (payload.message ? ` — ${payload.message}` : ""));
          }
        } catch (e) {
          // ignore errors during toast in render
        }
      });

      socket.on("disconnect", (reason) => {
        console.debug("notifications socket disconnected", reason);
      });

      return () => {
        try {
          socket.off("notification");
          socket.disconnect();
        } catch (e) {}
      };
    } catch (e) {
      // If socket.io-client isn't available or connection fails, silently ignore
      console.error("Failed to initialize notifications socket:", e);
    }
  }, []);

  // Auto-mark as read when card becomes visible
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-id");
            const notification = notifications.find((n) => n._id === id);
            if (notification && !notification.read) {
              await userApi.markNotificationRead(id);
              setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
              );
            }
          }
        });
      },
      { threshold: 0.5 },
    );
    const elements = document.querySelectorAll(".notification-card");
    elements.forEach((el) => observer.observe(el));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [notifications]);

  const handleNotificationClick = (notification) => {
    const { type, data } = notification;
    const policyId = data?.policyId;
    const associateId = data?.associateId;

    switch (type) {
      case "PLANNER_REQUEST_CREATED":
        if (data?.requestId) navigate(`/planner-requests?highlight=${data.requestId}`);
        else navigate(`/planner-requests`);
        break;
      case "POLICY_ACTIVATED":
      case "POLICY_CLOSED":
      case "POLICY_EXTENDED":
        if (policyId) navigate(`/policies/${policyId}`);
        break;
      case "ASSOCIATE_ACCEPTED":
      case "ASSOCIATE_REJECTED":
      case "ASSOCIATE_PERMISSIONS_UPDATED":
      case "ASSOCIATE_REVOKED":
      case "ASSOCIATE_SELF_REVOKED":
        if (policyId) navigate(`/policies/${policyId}?tab=associates`);
        break;
      case "ASSOCIATE_INVITED":
      case "INVITATION_EXPIRING_SOON":
        if (associateId)
          navigate(`/associates/invitations?highlight=${associateId}`);
        break;
      case "INVITATION_EXPIRED_RECEIVER":
      case "INVITATION_EXPIRED":
        navigate("/associates/invitations");
        break;
      case "MESSAGE_RECEIVED":
        navigate("/messages");
        break;
      case "COMMENT_REPLY":
      case "COMMENT_FLAGGED":
      case "COMMENT_APPEAL":
      case "APPEAL_RESOLVED":
        if (policyId) navigate(`/policies/${policyId}?tab=comments`);
        break;
      case "VOTE_SURGE":
      case "RATING_DROP":
      case "EMERGING_TOPIC":
        if (policyId) navigate(`/policies/${policyId}/analytics`);
        else navigate("/trends");
        break;
      case "PLANNER_APPROVED":
        navigate("/dashboard");
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <PageHeader
          title="Notifications"
          description="Review system alerts, collaboration updates, and policy events."
          className="flex-1"
        />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ml-4 mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <ErrorAlert message={error} />
      {loading ? (
        <LoadingState label="Loading notifications" />
      ) : notifications.length ? (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification._id}
              data-id={notification._id}
              className={`notification-card cursor-pointer rounded-lg border p-4 shadow-sm transition hover:bg-slate-50 ${
                notification.read
                  ? "border-slate-200 bg-white"
                  : "border-teal-200 bg-teal-50"
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {notification.type}
                  </p>
                  <h3 className="mt-1 font-bold text-slate-950">
                    {notification.title}
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {formatDate(notification.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {notification.message}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          description="New alerts and updates will appear here."
        />
      )}
    </div>
  );
}
