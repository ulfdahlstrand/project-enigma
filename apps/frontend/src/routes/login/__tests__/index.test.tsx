import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "../../../locales/en/common.json";
import { AuthProvider } from "../../../auth/auth-context";
import { Route } from "..";

// ---------------------------------------------------------------------------
// Mock @react-oauth/google — avoids needing a real client ID
// ---------------------------------------------------------------------------

const mockGoogleLogin = vi.fn();

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({
    onSuccess,
  }: {
    onSuccess: (resp: { credential?: string }) => void;
    onError: () => void;
  }) => (
    <button
      onClick={() => onSuccess({ credential: "mock.id.token" })}
    >
      Sign in with Google
    </button>
  ),
  useGoogleLogin: () => mockGoogleLogin,
}));

// ---------------------------------------------------------------------------
// Mock TanStack Router navigation
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// i18n setup
// ---------------------------------------------------------------------------

function buildI18n() {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["common"],
    defaultNS: "common",
    resources: { en: { common: enCommon } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const LoginPage = Route.options.component as React.ComponentType;

function renderLogin() {
  return render(
    <AuthProvider>
      <I18nextProvider i18n={buildI18n()}>
        <LoginPage />
      </I18nextProvider>
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the app name heading", () => {
    renderLogin();
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("renders the Sign in with Google button", () => {
    renderLogin();
    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it("stores the token in localStorage on successful login", async () => {
    renderLogin();
    await act(async () => {
      screen.getByRole("button", { name: /sign in with google/i }).click();
    });
    expect(localStorage.getItem("cv-tool:id-token")).toBe("mock.id.token");
  });

  it("navigates to /employee after successful login", async () => {
    renderLogin();
    await act(async () => {
      screen.getByRole("button", { name: /sign in with google/i }).click();
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/employee" });
  });
});
