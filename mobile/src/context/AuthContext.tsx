import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { api, setApiToken } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  setTokenAndUser: (token: string, user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    void (async () => {
      const token = await SecureStore.getItemAsync('auth_token');
      const userJson = await SecureStore.getItemAsync('auth_user');
      if (token && userJson) {
        setApiToken(token);
        setState({ user: JSON.parse(userJson) as User, token, loading: false });
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    })();
  }, []);

  const setTokenAndUser = async (token: string, user: User) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    setApiToken(token);
    setState({ user, token, loading: false });
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    await setTokenAndUser(data.token, data.user);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    setApiToken(null);
    setState({ user: null, token: null, loading: false });
  };

  const updateUser = async (user: User) => {
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    setState(s => ({ ...s, user }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, setTokenAndUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
