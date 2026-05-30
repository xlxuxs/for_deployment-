import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../api/client";
import { showToast } from "../lib/toast";

export default function NotificationsDevTest() {
  const [userId, setUserId] = useState("");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
    };
  }, [socket]);

  const connect = () => {
    if (!userId) return alert("Enter a userId to connect as");
    const origin = new URL(API_BASE_URL, window.location.origin).origin;
    const s = io(origin, { auth: { userId }, transports: ["websocket"] });
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("notification", (n) => {
      setMessages((m) => [n, ...m]);
      try {
        showToast("info", n.title || "Notification received");
      } catch (e) {}
    });
    s.on("connect_error", (err) => {
      setMessages((m) => [{ error: String(err) }, ...m]);
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Notifications dev test</h2>
      <p className="mt-2 text-sm text-slate-600">Connect as a user and watch real-time notifications.</p>
      <div className="mt-4 flex gap-2">
        <input className="rounded border px-3 py-1" placeholder="admin userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button className="rounded bg-teal-600 px-3 py-1 text-white" onClick={connect}>Connect</button>
        <span className="ml-4">Status: {connected ? "connected" : "disconnected"}</span>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Received</h3>
        <div className="mt-2 space-y-2">
          {messages.map((m, i) => (
            <pre key={i} className="rounded border bg-white p-2 text-xs">{JSON.stringify(m, null, 2)}</pre>
          ))}
        </div>
      </div>
    </div>
  );
}
