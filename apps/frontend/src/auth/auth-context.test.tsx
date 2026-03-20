import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";
import type { GetCurrentSessionOutput } from "@cv-tool/contracts";
import { resetAuthSession } from "./session-store";
const SESSION_RESPONSE: GetCurrentSessionOutput = {
  user: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "alice@example.com",
    name: "Alice Example",
    role: "consultant",
  },
};

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function TestConsumer() {
  const { user, isAuthenticated, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.email ?? "null"}</span>
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
    resetAuthSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts loading and unauthenticated; settles unauthenticated when session bootstrap fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    renderWithAuth();
    expect(screen.getByTestId("loading").textContent).toBe("true");
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("auth").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("authenticates from the current session endpoint on mount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SESSION_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe(SESSION_RESPONSE.user.email);
  });

  it("persists the user after login refreshes the session snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/auth/session")) {
        return Promise.resolve(
          new Response(JSON.stringify(SESSION_RESPONSE), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ accessToken: "unused.access.token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    function LoginConsumer() {
      const { login, user } = useAuth();
      return (
        <div>
          <button onClick={() => void login("google-credential")}>login</button>
          <span data-testid="login-user">{user?.email ?? "null"}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByRole("button", { name: "login" }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("login-user").textContent).toBe(SESSION_RESPONSE.user.email)
    );
  });

  it("clears the session snapshot when bootstrap fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});
