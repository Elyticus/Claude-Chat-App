import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL || "/", {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    // Never give up reconnecting — mobile browsers suspend sockets when the app
    // is backgrounded/locked, and a capped attempt count would leave the socket
    // permanently dead (no live messages) until a full page reload.
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
