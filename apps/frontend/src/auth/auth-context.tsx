/**
 * AuthContext — session bootstrap is derived from the backend session cookie.
 *
 * On mount we ask the backend for the current authenticated session via
 * GET /auth/session. That response becomes the source of truth for route
 * guards and the visible user state. A short-lived bearer token still exists
 * for legacy API calls until the transport cleanup lands, but bootstrap no
 * longer depends on it or on localStorage flags.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { CurrentSessionUser } from "@cv-tool/contracts";
import { setStoredToken } from "./token-store";
import {
  clearAuthSession,
  ensureAuthSession,
  getAuthSessionSnapshot,
  refreshAuthSession,
  subscribeAuthSession,
} from "./session-store";

const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

type AuthContextValue = {
  user: CurrentSessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (googleCredential: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const session = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getAuthSessionSnapshot
  );

  useEffect(() => {
    void ensureAuthSession();
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearAuthSession();
        setStoredToken(null);
        setToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string };
      setStoredToken(data.accessToken);
      setToken(data.accessToken);
      await refreshAuthSession();
      return data.accessToken;
    } catch {
      clearAuthSession();
      setStoredToken(null);
      setToken(null);
      return null;
    }
  }, []);

  const login = useCallback(async (googleCredential: string): Promise<void> => {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential: googleCredential }),
    });
    if (!res.ok) {
      throw new Error("Login failed");
    }
    const data = (await res.json()) as { accessToken: string };
    setStoredToken(data.accessToken);
    setToken(data.accessToken);
    await refreshAuthSession();
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — always clear local state
    }
    clearAuthSession();
    setStoredToken(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        token,
        isAuthenticated: session.status === "authenticated",
        isLoading: session.status === "loading",
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
