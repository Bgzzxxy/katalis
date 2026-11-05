import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, type User, type DataStatus } from "../lib/types";
import { login as apiLogin, logout as apiLogout, register as apiRegister } from "../lib/api";

type AuthContextValue = {
  status: DataStatus;
  user: User | null;
  error: ApiError | null;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async (): Promise<User | null> => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        setStatus("empty");
        return null;
      }
      if (!res.ok) throw new ApiError(res.status, "HTTP_" + res.status, "Gagal memuat sesi");
      const next = (await res.json()) as User;
      setUser(next);
      setStatus("populated");
      return next;
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server");
      setUser(null);
      setError(apiErr);
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await apiLogin(email, password));
    setStatus("populated");
    setError(null);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await apiRegister(email, password);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("empty");
  }, []);

  const value = useMemo(
    () => ({ status, user, error, refresh, login, register, logout }),
    [status, user, error, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}