import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "../../../locales/en/common.json";
import { AuthProvider } from "../../../auth/auth-context";
import { resetAuthSession } from "../../../auth/session-store";
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

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage", () => {
  beforeEach(() => {
    resetAuthSession();
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/auth/session")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }

      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: "access.token.value" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("navigates to /employees after successful login", async () => {
    renderLogin();
    await act(async () => {
      screen.getByRole("button", { name: /sign in with google/i }).click();
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/employees" })
    );
  });

  it("renders the login subtitle", () => {
    renderLogin();
    expect(screen.getByText(enCommon.auth.loginSubtitle)).toBeInTheDocument();
  });

  it("renders the help text", () => {
    renderLogin();
    expect(screen.getByText(enCommon.auth.loginHelp)).toBeInTheDocument();
  });

  it("shows loading state after clicking sign in", async () => {
    renderLogin();
    await act(async () => {
      screen.getByRole("button", { name: /sign in with google/i }).click();
    });
    // After click, the Google button should be replaced by progress indicator
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
