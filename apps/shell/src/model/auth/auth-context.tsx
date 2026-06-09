import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const BFF_URL = (process.env.BFF_URL as string) || 'http://localhost:3000';

interface AuthState {
  accessToken: string | null;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  /** Authenticated fetch against the BFF; auto-refreshes once on 401. */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Access token lives in memory only (never localStorage). Refresh token is
  // an httpOnly cookie owned by the BFF.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // On load: capture token from the callback fragment, or try a silent refresh.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#access_token=')) {
      const token = decodeURIComponent(hash.slice('#access_token='.length));
      setAccessToken(token);
      window.history.replaceState({}, '', window.location.pathname);
      setReady(true);
      return;
    }
    // Attempt silent refresh via the BFF refresh cookie.
    void fetch(`${BFF_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.access_token) setAccessToken(data.access_token);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(() => {
    window.location.href = `${BFF_URL}/auth/login`;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BFF_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    setAccessToken(null);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    const r = await fetch(`${BFF_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!r.ok) return null;
    const data = await r.json();
    setAccessToken(data.access_token ?? null);
    return data.access_token ?? null;
  }, []);

  const api = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const call = (token: string | null) =>
        fetch(`${BFF_URL}${path}`, {
          ...init,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
          },
        });

      let res = await call(accessToken);
      if (res.status === 401) {
        const fresh = await refresh();
        if (fresh) res = await call(fresh);
      }
      return res;
    },
    [accessToken, refresh],
  );

  const value = useMemo<AuthState>(
    () => ({ accessToken, authenticated: !!accessToken, login, logout, api }),
    [accessToken, login, logout, api],
  );

  if (!ready) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
