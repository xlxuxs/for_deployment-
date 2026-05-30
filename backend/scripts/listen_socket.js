const { io } = require("socket.io-client");

const USER_ID = process.argv[2] || "6a18b1d411ddfa830ef7865c"; // pass admin id as arg
const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  auth: { userId: USER_ID },
  transports: ["websocket"],
  reconnection: false,
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("notification", (n) => {
  console.log("received notification:", n);
});

socket.on("connect_error", (err) => {
  console.error("connect_error", err.message || err);
  process.exit(1);
});

setTimeout(() => {
  console.log("exiting after timeout");
  socket.close();
  process.exit(0);
}, 15000);
