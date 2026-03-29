import type { CurrentSessionUser, GetCurrentSessionOutput } from "@cv-tool/contracts";

const apiUrl: string = import.meta.env["VITE_API_URL"] ?? "";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthSessionSnapshot = {
  status: AuthStatus;
  user: CurrentSessionUser | null;
};

let snapshot: AuthSessionSnapshot = {
  status: "loading",
  user: null,
};

let inFlightRequest: Promise<AuthSessionSnapshot> | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: AuthSessionSnapshot) {
  snapshot = next;
  emit();
}

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
  if (!force && snapshot.status !== "loading") {
    return snapshot;
  }

  if (!force && inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = fetchCurrentSession()
    .catch(() => ({ status: "unauthenticated", user: null } as const))
    .then((next) => {
      setSnapshot(next);
      return next;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

export function getAuthSessionSnapshot(): AuthSessionSnapshot {
  return snapshot;
}

export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ensureAuthSession(): Promise<AuthSessionSnapshot> {
  return loadCurrentSession(false);
}

export function refreshAuthSession(): Promise<AuthSessionSnapshot> {
  return loadCurrentSession(true);
}

export function clearAuthSession(): void {
  inFlightRequest = null;
  setSnapshot({ status: "unauthenticated", user: null });
}

export function resetAuthSession(): void {
  inFlightRequest = null;
  setSnapshot({ status: "loading", user: null });
}
