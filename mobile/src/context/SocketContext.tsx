import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = connectSocket(token);
    setSocket(s);

    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (s.connected) setConnected(true);

    // The OS suspends the socket when the app is backgrounded. On return to the
    // foreground, force a reconnect if it dropped so live events resume without
    // a manual reload. Screens re-pull their data on focus to fill any gap.
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active' && !s.connected) s.connect();
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      appStateSub.remove();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
