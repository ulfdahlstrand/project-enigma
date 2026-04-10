/**
 * AuthContext — session bootstrap is derived from the backend session cookie.
 *
 * On mount we ask the backend for the current authenticated session via
 * GET /auth/session. That response becomes the source of truth for route
 * guards and the visible user state. The frontend no longer stores or injects
 * bearer tokens for normal API traffic; authenticated requests rely on the
 * backend-managed cookie/session model instead.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { CurrentSessionUser } from "@cv-tool/contracts";
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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getAuthSessionSnapshot
  );

  useEffect(() => {
    void ensureAuthSession();
  }, []);

  const login = useCallback(async (credential: string): Promise<void> => {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      throw new Error("Login failed");
    }
    await res.json();
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
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        isAuthenticated: session.status === "authenticated",
        isLoading: session.status === "loading",
        login,
        logout,
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
