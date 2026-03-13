import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

const TOKEN = "header.payload.signature";

function TestConsumer() {
  const { token, isAuthenticated, setToken, clearToken } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? "null"}</span>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <button onClick={() => setToken(TOKEN)}>login</button>
      <button onClick={() => clearToken()}>logout</button>
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
  });

  it("starts unauthenticated when localStorage is empty", () => {
    renderWithAuth();
    expect(screen.getByTestId("auth").textContent).toBe("false");
    expect(screen.getByTestId("token").textContent).toBe("null");
  });

  it("restores token from localStorage on mount", () => {
    localStorage.setItem("cv-tool:id-token", TOKEN);
    renderWithAuth();
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(screen.getByTestId("token").textContent).toBe(TOKEN);
  });

  it("setToken persists to localStorage and marks as authenticated", () => {
    renderWithAuth();
    act(() => screen.getByRole("button", { name: "login" }).click());
    expect(screen.getByTestId("auth").textContent).toBe("true");
    expect(localStorage.getItem("cv-tool:id-token")).toBe(TOKEN);
  });

  it("clearToken removes from localStorage and marks as unauthenticated", () => {
    localStorage.setItem("cv-tool:id-token", TOKEN);
    renderWithAuth();
    act(() => screen.getByRole("button", { name: "logout" }).click());
    expect(screen.getByTestId("auth").textContent).toBe("false");
    expect(localStorage.getItem("cv-tool:id-token")).toBeNull();
  });
});
