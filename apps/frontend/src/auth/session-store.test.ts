import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentSessionUser } from "@cv-tool/contracts";
import {
  clearAuthSession,
  ensureAuthSession,
  getAuthSessionSnapshot,
  refreshAuthSession,
  resetAuthSession,
  subscribeAuthSession,
} from "./session-store";

const originalFetch = globalThis.fetch;

const user: CurrentSessionUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Test User",
  role: "consultant",
};

function mockFetchAuthenticated() {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ user }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  return fetch;
}

function mockFetchUnauthenticated() {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  return fetch;
}

function mockFetchFailing() {
  const fetch = vi.fn().mockRejectedValue(new Error("network down"));
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  return fetch;
}

beforeEach(() => {
  resetAuthSession();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("session-store", () => {
  it("starts in loading state with null user", () => {
    expect(getAuthSessionSnapshot()).toEqual({ status: "loading", user: null });
  });

  it("ensureAuthSession resolves to authenticated on 200", async () => {
    mockFetchAuthenticated();
    const result = await ensureAuthSession();
    expect(result).toEqual({ status: "authenticated", user });
    expect(getAuthSessionSnapshot()).toEqual({
      status: "authenticated",
      user,
    });
  });

  it("ensureAuthSession resolves to unauthenticated on 401", async () => {
    mockFetchUnauthenticated();
    const result = await ensureAuthSession();
    expect(result).toEqual({ status: "unauthenticated", user: null });
    expect(getAuthSessionSnapshot()).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });

  it("ensureAuthSession falls back to unauthenticated on network failure", async () => {
    mockFetchFailing();
    const result = await ensureAuthSession();
    expect(result).toEqual({ status: "unauthenticated", user: null });
  });

  it("dedupes parallel ensureAuthSession calls into one fetch", async () => {
    const fetch = mockFetchAuthenticated();
    const [a, b, c] = await Promise.all([
      ensureAuthSession(),
      ensureAuthSession(),
      ensureAuthSession(),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("ensureAuthSession is a no-op once snapshot is resolved", async () => {
    const fetch = mockFetchAuthenticated();
    await ensureAuthSession();
    await ensureAuthSession();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshAuthSession forces a new fetch even when already resolved", async () => {
    const fetch = mockFetchAuthenticated();
    await ensureAuthSession();
    await refreshAuthSession();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("clearAuthSession sets unauthenticated", async () => {
    mockFetchAuthenticated();
    await ensureAuthSession();
    clearAuthSession();
    expect(getAuthSessionSnapshot()).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });

  it("resetAuthSession sets loading", async () => {
    mockFetchAuthenticated();
    await ensureAuthSession();
    resetAuthSession();
    expect(getAuthSessionSnapshot()).toEqual({ status: "loading", user: null });
  });

  it("notifies subscribers on every snapshot change", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);
    mockFetchAuthenticated();
    await ensureAuthSession();
    clearAuthSession();
    resetAuthSession();
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);
    unsubscribe();
    mockFetchAuthenticated();
    await ensureAuthSession();
    expect(listener).not.toHaveBeenCalled();
  });
});
