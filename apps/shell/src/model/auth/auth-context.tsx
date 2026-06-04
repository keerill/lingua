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

  roles: string[];
  login: () => void;
  logout: () => Promise<void>;

  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeRoles(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      ),
    );
    return (json?.realm_access?.roles as string[]) ?? [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#access_token=')) {
      const token = decodeURIComponent(hash.slice('#access_token='.length));
      setAccessToken(token);
      window.history.replaceState({}, '', window.location.pathname);
      setReady(true);
      return;
    }
    void fetch(`${BFF_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
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
    await fetch(`${BFF_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
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

  const roles = useMemo(() => decodeRoles(accessToken), [accessToken]);

  const value = useMemo<AuthState>(
    () => ({
      accessToken,
      authenticated: !!accessToken,
      roles,
      login,
      logout,
      api,
    }),
    [accessToken, roles, login, logout, api],
  );

  if (!ready) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
