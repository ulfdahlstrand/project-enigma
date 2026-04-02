import type { PersistedInlineRevisionSession } from "./types";

function getInlineRevisionStorageKey(branchId: string) {
  return `inline-resume-revision:${branchId}`;
}

export function readPersistedInlineRevisionSession(
  branchId: string,
): PersistedInlineRevisionSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getInlineRevisionStorageKey(branchId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedInlineRevisionSession;
    if (parsed.version !== 1) {
      return null;
    }

    if (parsed.stage !== "actions" && parsed.stage !== "finalize") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedInlineRevisionSession(
  branchId: string,
  session: PersistedInlineRevisionSession,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getInlineRevisionStorageKey(branchId), JSON.stringify(session));
}

export function clearPersistedInlineRevisionSession(branchId: string | null) {
  if (typeof window === "undefined" || !branchId) {
    return;
  }

  window.localStorage.removeItem(getInlineRevisionStorageKey(branchId));
}
