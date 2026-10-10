import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './lib/types';

interface AuthState {
  user: User | null;
  org: { id: number; name: string } | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<AuthState['org']>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: User | null; org: AuthState['org'] }>('/api/me');
      setUser(r.user);
      setOrg(r.org ?? null);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const login = async (email: string, password: string) => {
    const r = await api.post<{ user: User }>('/api/auth/login', { email, password });
    await refresh();
    return r.user;
  };
  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };
  return <Ctx.Provider value={{ user, org, ready, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/** Where each role lands after signing in. */
export const homeFor = (u: User | null) => (!u ? '/login' : u.role === 'hire' ? '/today' : u.role === 'admin' ? '/admin' : '/tasks');
