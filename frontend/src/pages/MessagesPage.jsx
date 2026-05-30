import { ChevronDown, Search, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { messageApi } from "../api/messages";
import { plannerApi } from "../api/planners";
import { LANGUAGES } from "../constants/regions";
import { EmptyState } from "../components/EmptyState";
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

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return `${Math.max(1, Math.abs(diffMinutes))}m ago`;
  }

  if (Math.abs(diffHours) < 24) {
    return `${Math.max(1, Math.abs(diffHours))}h ago`;
  }

  return formatDate(value);
}

export function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [planners, setPlanners] = useState([]);
  const [language, setLanguage] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "" });
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadInbox() {
    setLoading(true);
    setError("");
    try {
      const result = await messageApi.conversations({ limit: 50 });
      setConversations(result.conversations || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load inbox"));
    } finally {
      setLoading(false);
    }
  }

  async function searchPlanners(nextLanguage = language) {
    setError("");
    try {
      const result = await plannerApi.search(nextLanguage);
      setPlanners(Array.isArray(result) ? result : []);
    } catch (err) {
      // If search fails, try to get all planners without language filter
      try {
        // For now, let's create a fallback - we might need to add an API endpoint for all planners
        setPlanners([]);
        setError("No planners found for the selected language. Try selecting 'All' or contact admin.");
      } catch (fallbackErr) {
        setError(getErrorMessage(err, "Failed to search planners"));
      }
    }
  }

  useEffect(() => {
    loadInbox();
    searchPlanners("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].conversationId);
    }
  }, [conversations, selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return conversations
      .filter((conversation) => (!showUnreadOnly ? true : conversation.unreadCount > 0))
      .filter((conversation) => {
        if (!query) return true;
        const counterpartEmail = conversation.counterpartEmail || "";
        const subject = conversation.latestMessage?.subject || "";
        const body = conversation.latestMessage?.body || "";
        const senderEmail = conversation.latestMessage?.senderId?.email || "";
        return [counterpartEmail, senderEmail, subject, body].some((value) =>
          value.toLowerCase().includes(query),
        );
      })
      .sort((left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt));
  }, [conversations, searchTerm, showUnreadOnly]);

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConversationId("");
      return;
    }

    const stillVisible = filteredConversations.some((conversation) => conversation.conversationId === selectedConversationId);
    if (!stillVisible) {
      setSelectedConversationId(filteredConversations[0].conversationId);
    }
  }, [filteredConversations, selectedConversationId]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.conversationId === selectedConversationId) ||
    filteredConversations[0] ||
    null;
  const selectedMessage = selectedConversation?.latestMessage || null;

  async function sendMessage(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.recipientId || !form.subject.trim() || !form.body.trim()) {
      setError("Recipient, subject, and body are required.");
      return;
    }
    setSending(true);
    try {
      await messageApi.send(form);
      setNotice("Message sent.");
      try { showToast('success', 'Message sent.'); } catch (e) {}
      setForm({ recipientId: "", subject: "", body: "" });
      await loadInbox();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send message"));
    } finally {
      setSending(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedMessage) return;

    if (!replyBody.trim()) {
      setError("Reply body is required.");
      return;
    }

    setReplying(true);
    setError("");
    setNotice("");
    try {
      await messageApi.reply(selectedMessage._id, replyBody.trim());
      setReplyBody("");
      setNotice("Reply sent.");
      try { showToast('success', 'Reply sent.'); } catch (e) {}
      await loadInbox();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send reply"));
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="messages-page space-y-6 pb-8">
      <PageHeader
        title="Messages"
        description="A chat-style workspace for conversations, quick replies, and planner collaboration."
      />
      <ErrorAlert message={error} />

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[760px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="space-y-5 p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search messages"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowUnreadOnly((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    showUnreadOnly
                      ? "bg-teal-700 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-teal-300"
                  }`}
                >
                  Unread only
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                    Inbox
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">
                    {filteredConversations.length} conversations
                  </span>
                </div>

                {loading ? (
                  <LoadingState label="Loading inbox" />
                ) : filteredConversations.length ? (
                  <div className="space-y-2">
                    {filteredConversations.map((conversation) => {
                      const active = conversation.conversationId === selectedConversationId;
                      return (
                        <button
                          key={conversation.conversationId}
                          type="button"
                          onClick={() => setSelectedConversationId(conversation.conversationId)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-teal-300 bg-teal-50 shadow-md"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${active ? "bg-teal-700 text-white" : "bg-slate-900 text-white"}`}>
                              {getInitials(conversation.counterpartEmail)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-950">
                                    {conversation.counterpartEmail || "Unknown user"}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs uppercase tracking-wide text-slate-500">
                                    {conversation.latestMessage?.subject}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {conversation.unreadCount > 0 ? (
                                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-teal-700">
                                      {conversation.unreadCount}
                                    </span>
                                  ) : null}
                                  <span className="text-[11px] font-medium text-slate-400">
                                    {formatRelativeTime(conversation.lastMessageAt)}
                                  </span>
                                </div>
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                {conversation.latestMessage?.body}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No messages yet"
                    description="Messages from planners and admins will appear here."
                  />
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setComposerOpen((current) => !current)}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                      New conversation
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-slate-950">Send a message</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Start a direct conversation with any planner or admin account.
                    </p>
                  </div>
                  <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${composerOpen ? "rotate-180" : "rotate-0"}`} />
                  </span>
                </button>

                {composerOpen ? (
                  <div className="border-t border-slate-200 p-5">
                    <form className="space-y-3" onSubmit={sendMessage}>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient language</p>
                        <div className="mt-2 flex gap-2">
                          <select
                            value={language}
                            onChange={(event) => {
                              setLanguage(event.target.value);
                              searchPlanners(event.target.value);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                          >
                            {LANGUAGES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => searchPlanners()}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Search
                          </button>
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Recipient</span>
                        <select
                          value={form.recipientId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, recipientId: event.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-400"
                        >
                          <option value="">Choose a planner</option>
                          {planners.map((planner) => (
                            <option key={planner._id} value={planner._id}>
                              {planner.email}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Subject</span>
                        <input
                          value={form.subject}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, subject: event.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-400"
                          placeholder="Thread title"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Message</span>
                        <textarea
                          rows="5"
                          value={form.body}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, body: event.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-400"
                          placeholder="Write your message..."
                        />
                      </label>

                      <button
                        disabled={sending}
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {sending ? "Sending..." : "Send message"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
                    Tap to open the message composer.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-slate-50/60">
            {selectedMessage ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                      {getInitials(selectedMessage.senderId?.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-950">
                        {selectedMessage.subject}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        From {selectedMessage.senderId?.email || "Unknown"} • {formatDate(selectedMessage.createdAt)}
                      </p>
                    </div>
                  </div>

                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Conversation preview
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {selectedMessage.read ? "Read" : "Unread"} • {selectedConversation?.counterpartEmail || "Your inbox"}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedMessage.read ? "bg-slate-100 text-slate-600" : "bg-teal-100 text-teal-700"}`}>
                        {selectedMessage.read ? "Read" : "New"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {selectedMessage.replyToId ? (
                        <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Earlier message</p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {selectedMessage.replyToId.subject || "Previous message"}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap leading-6">
                            {selectedMessage.replyToId.body || "Conversation context is available in the full thread."}
                          </p>
                        </div>
                      ) : null}

                      <div className="ml-auto max-w-[85%] rounded-3xl bg-teal-700 px-5 py-4 text-white shadow-lg shadow-teal-900/10">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">
                            {selectedMessage.senderId?.email || "Unknown sender"}
                          </p>
                          <p className="text-[11px] font-medium text-teal-100">
                            {formatRelativeTime(selectedMessage.createdAt)}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/95">
                          {selectedMessage.body}
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={sendReply} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">Reply</p>
                      </div>
                    </div>

                    <textarea
                      rows="5"
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder={`Reply to ${selectedMessage.senderId?.email || "this message"}...`}
                      className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        disabled={replying}
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {replying ? "Sending..." : "Send reply"}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                  title="Pick a conversation"
                  description="Select a thread on the left or send a new message to start chatting."
                />
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
