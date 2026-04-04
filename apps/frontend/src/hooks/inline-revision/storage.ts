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
    const parsed = JSON.parse(raw) as PersistedInlineRevisionSession | (Omit<PersistedInlineRevisionSession, "version" | "conversationId"> & { version: 2 });
    if (parsed.version !== 2 && parsed.version !== 3) {
      return null;
    }

    return {
      ...parsed,
      version: 3,
      conversationId: "conversationId" in parsed ? parsed.conversationId ?? null : null,
    };
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

export function patchPersistedInlineRevisionSession(
  branchId: string,
  updater: (current: PersistedInlineRevisionSession | null) => PersistedInlineRevisionSession | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readPersistedInlineRevisionSession(branchId);
  const next = updater(current);
  if (!next) {
    return;
  }

  writePersistedInlineRevisionSession(branchId, next);
}

export function clearPersistedInlineRevisionSession(branchId: string | null) {
  if (typeof window === "undefined" || !branchId) {
    return;
  }

  window.localStorage.removeItem(getInlineRevisionStorageKey(branchId));
}
