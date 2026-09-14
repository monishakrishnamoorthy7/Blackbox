import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || undefined;
    socket = io(url, {
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
