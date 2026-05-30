import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { messageApi } from "../api/messages";
import { useAuth } from "../auth/AuthContext";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { formatDate, getErrorMessage } from "../lib/format";
import { showToast } from "../lib/toast";

function getInitials(value) {
  if (!value) return "?";
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function MessageDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);
  const [thread, setThread] = useState([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const conversationMeta = useMemo(() => {
    if (!message) return null;

    const participants = [message.senderId?.email, message.recipientId?.email].filter(Boolean);
    return {
      participants,
      isReply: Boolean(message.replyToId),
    };
  }, [message]);

  async function loadMessage() {
    setLoading(true);
    setError("");
    try {
      const fetchedMessage = await messageApi.get(id);
      const nextMessage = fetchedMessage.message || fetchedMessage;
      const nextThread = fetchedMessage.thread || [nextMessage];
      setMessage(nextMessage);
      setThread(nextThread);
      window.dispatchEvent(new Event("messages:changed"));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load message"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim()) {
      setError("Reply body is required.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      await messageApi.reply(id, reply.trim());
      const outgoingReply = {
        _id: `local-${Date.now()}`,
        senderId: { email: user?.email || "You" },
        recipientId: message?.senderId || { email: "Unknown" },
        subject: message?.subject?.startsWith("Re:") ? message.subject : `Re: ${message?.subject || "Message"}`,
        body: reply.trim(),
        read: true,
        createdAt: new Date().toISOString(),
        localReply: true,
      };
      setThread((current) => [...current, outgoingReply]);
      setReply("");
      setNotice(`Reply sent: ${reply.trim()}`);
      window.dispatchEvent(new Event("messages:changed"));
      try { showToast('success', 'Reply sent.'); } catch (e) {}
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send reply"));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState label="Loading message" />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={message?.subject || "Message"}
        description={
          message
            ? `From ${message.senderId?.email || "Unknown"} to ${message.recipientId?.email || "Unknown"} • ${formatDate(message.createdAt)}`
            : ""
        }
        actions={
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inbox
          </Link>
        }
      />
      <ErrorAlert message={error} />
      {notice ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}

      {message ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                  {getInitials(message.senderId?.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-950">{message.subject}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {conversationMeta?.participants.join(" • ")}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${message.read ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-700"}`}
              >
                {message.read ? "Read" : "Unread"}
              </span>
            </div>

            <div className="mt-5 space-y-4 rounded-3xl bg-slate-50 p-4">
              {message.replyToId ? (
                <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Earlier chat
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {message.replyToId.subject || "Conversation context"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-6">
                    {message.replyToId.body || "The original message is available in the thread."}
                  </p>
                </div>
              ) : null}

                {thread.map((entry) => {
                const isOutgoing = entry.localReply || entry.senderId?.email === user?.email;
                return (
                  <div
                    key={entry._id}
                    className={`max-w-[90%] rounded-3xl px-5 py-4 shadow-sm ${
                      isOutgoing
                        ? "ml-auto bg-teal-700 text-white shadow-teal-900/10"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isOutgoing ? "text-teal-100" : "text-slate-400"}`}>
                        {isOutgoing ? "You" : entry.senderId?.email || "Unknown sender"}
                      </p>
                      <p className={`text-[11px] font-medium ${isOutgoing ? "text-teal-100" : "text-slate-400"}`}>
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                    <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${isOutgoing ? "text-white/95" : "text-slate-700"}`}>
                      {entry.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                Chat details
              </h3>
              <dl className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</dt>
                  <dd className="mt-1 text-sm font-bold text-slate-950">{message.senderId?.email || "Unknown"}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</dt>
                  <dd className="mt-1 text-sm font-bold text-slate-950">{message.recipientId?.email || "Unknown"}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="mt-1 text-sm font-bold text-slate-950">{message.read ? "Read" : "Unread"}</dd>
                </div>
              </dl>
            </section>

            <form onSubmit={sendReply} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-950">Reply</h3>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-slate-700">Reply</span>
                <textarea
                  rows="7"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  placeholder="Write your reply..."
                />
              </label>
              <button
                disabled={sending}
                type="submit"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send reply"}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
