import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

const SESSION_FLAG_KEY = "cv-tool:has-session";
const ACCESS_TOKEN = "header.payload.signature";

// Mock fetch for silent refresh on mount
function mockFetchRejects() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 401 })
  );
}

function mockFetchSucceeds() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ accessToken: ACCESS_TOKEN }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function TestConsumer() {
  const { token, isAuthenticated, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? "null"}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe("AuthProvider / useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts loading and unauthenticated; settles unauthenticated when refresh fails", async () => {
    mockFetchRejects();
    renderWithAuth();
    expect(screen.getByTestId("loading").textContent).toBe("true");
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("auth").textContent).toBe("false");
    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(localStorage.getItem(SESSION_FLAG_KEY)).toBeNull();
  });

  it("authenticates silently when refresh cookie succeeds on mount", async () => {
    mockFetchSucceeds();
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("token").textContent).toBe(ACCESS_TOKEN);
    expect(localStorage.getItem(SESSION_FLAG_KEY)).toBe("1");
  });

  it("clears session flag when refresh fails", async () => {
    localStorage.setItem(SESSION_FLAG_KEY, "1");
    mockFetchRejects();
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(localStorage.getItem(SESSION_FLAG_KEY)).toBeNull();
  });
});
