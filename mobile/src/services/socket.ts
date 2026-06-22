import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const SOCKET_URL: string =
  (Constants.expoConfig?.extra?.socketUrl as string | undefined) ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token },
    // No fixed transport: let it negotiate (polling → upgrade to websocket) so
    // it still connects on flaky mobile networks / proxies that block raw WS.
    reconnection: true,
    // Infinite attempts: the OS suspends a backgrounded app's socket; a capped
    // count would leave it permanently dead until a full app restart.
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
