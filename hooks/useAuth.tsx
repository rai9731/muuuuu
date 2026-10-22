import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { authService, type RegisterPayload } from '@services/authService';
import { onUnauthorized, tokenStorage } from '@services/api';
import type { User } from '@services/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    // Sentry recebe apenas o id — nenhum dado pessoal (LGPD).
    Sentry.setUser(u ? { id: String(u.id) } : null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null);
      return null;
    }
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    refresh().finally(() => setLoading(false));
  }, [refresh, setUser]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const u = await authService.login(email, password, remember);
      setUser(u);
      return u;
    },
    [setUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const u = await authService.register(payload);
      setUser(u);
      return u;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await authService.logout().catch(() => undefined);
    setUser(null);
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, register, logout, refresh, setUser }),
    [user, loading, login, register, logout, refresh, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

/** Rota inicial de cada perfil após o login. */
export const homeFor = (user: User): string => {
  if (user.must_change_password) return '/trocar-senha';
  return user.role === 'admin' ? '/admin' : '/painel';
};
