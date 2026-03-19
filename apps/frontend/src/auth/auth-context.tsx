/**
 * AuthContext — access token stored in React state only (not localStorage).
 *
 * On mount we attempt a silent refresh via POST /auth/refresh (which reads
 * the HttpOnly refresh cookie set by the backend). If the cookie is present
 * and valid we get a fresh access token without any user interaction.
 *
 * A `cv-tool:has-session` flag in localStorage is the only thing stored
 * client-side — it lets the router guard redirect to /login quickly on page
 * load, without waiting for the async silent-refresh attempt to complete.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setStoredToken } from "./token-store";

const SESSION_FLAG_KEY = "cv-tool:has-session";
const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

type AuthContextValue = {
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
  const [isLoading, setIsLoading] = useState(true);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        localStorage.removeItem(SESSION_FLAG_KEY);
        setToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string };
      localStorage.setItem(SESSION_FLAG_KEY, "1");
      setStoredToken(data.accessToken);
      setToken(data.accessToken);
      return data.accessToken;
    } catch {
      localStorage.removeItem(SESSION_FLAG_KEY);
      setStoredToken(null);
      setToken(null);
      return null;
    }
  }, []);

  // Silent refresh on mount to restore session from HttpOnly cookie
  useEffect(() => {
    void refreshToken().finally(() => setIsLoading(false));
  }, [refreshToken]);

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
    localStorage.setItem(SESSION_FLAG_KEY, "1");
    setStoredToken(data.accessToken);
    setToken(data.accessToken);
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
    localStorage.removeItem(SESSION_FLAG_KEY);
    setStoredToken(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: token !== null, isLoading, login, logout, refreshToken }}
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
