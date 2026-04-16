import { createStore } from "zustand";
import type { CurrentSessionUser, GetCurrentSessionOutput } from "@cv-tool/contracts";

const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthSessionSnapshot = {
  status: AuthStatus;
  user: CurrentSessionUser | null;
};

const initialSnapshot: AuthSessionSnapshot = {
  status: "loading",
  user: null,
};

const authSessionStore = createStore<AuthSessionSnapshot>(() => initialSnapshot);

let inFlightRequest: Promise<AuthSessionSnapshot> | null = null;

async function fetchCurrentSession(): Promise<AuthSessionSnapshot> {
  const res = await fetch(`${apiUrl}/auth/session`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 401) {
    return { status: "unauthenticated", user: null };
  }

  if (!res.ok) {
    throw new Error("Failed to fetch current session");
  }

  const data = (await res.json()) as GetCurrentSessionOutput;

  return {
    status: "authenticated",
    user: data.user,
  };
}

async function loadCurrentSession(force: boolean): Promise<AuthSessionSnapshot> {
  if (!force && authSessionStore.getState().status !== "loading") {
    return authSessionStore.getState();
  }

  if (!force && inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = fetchCurrentSession()
    .catch(() => ({ status: "unauthenticated", user: null }) as const)
    .then((next) => {
      authSessionStore.setState(next, true);
      return next;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

export function getAuthSessionSnapshot(): AuthSessionSnapshot {
  return authSessionStore.getState();
}

export function subscribeAuthSession(listener: () => void): () => void {
  return authSessionStore.subscribe(listener);
}

export function ensureAuthSession(): Promise<AuthSessionSnapshot> {
  return loadCurrentSession(false);
}

export function refreshAuthSession(): Promise<AuthSessionSnapshot> {
  return loadCurrentSession(true);
}

export function clearAuthSession(): void {
  inFlightRequest = null;
  authSessionStore.setState({ status: "unauthenticated", user: null }, true);
}

export function resetAuthSession(): void {
  inFlightRequest = null;
  authSessionStore.setState(initialSnapshot, true);
}
