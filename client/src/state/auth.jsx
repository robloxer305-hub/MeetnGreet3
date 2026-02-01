import React, { createContext, useContext, useMemo, useState } from 'react';
import { createApiClient } from '../lib/api.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'mg_token';
const USER_KEY = 'mg_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const api = useMemo(() => createApiClient(() => token), [token]);

  function setSession(nextToken, nextUser) {
    setToken(nextToken || '');
    setUser(nextUser || null);
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem('token', nextToken); // Also save under 'token' key for compatibility
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('token'); // Also remove from 'token' key
    }
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
  }

  async function refreshMe() {
    if (!token) return null;
    const res = await api.get('/auth/me');
    const u = res.data.user;
    setSession(token, u);
    return u;
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    setSession(res.data.token, res.data.user);
    return res.data.user;
  }

  async function register(email, password, displayName) {
    const res = await api.post('/auth/register', { email, password, displayName });
    setSession(res.data.token, res.data.user);
    return res.data.user;
  }

  function logout() {
    setSession('', null);
  }

  const value = {
    token,
    user,
    api,
    isAuthed: Boolean(token),
    login,
    register,
    refreshMe,
    logout,
    setSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
