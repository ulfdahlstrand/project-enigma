import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import enCommon from "../../../../locales/en/common.json";
import { Route } from "../external-ai";

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listExternalAIClients: vi.fn(),
    listExternalAIAuthorizations: vi.fn(),
    createExternalAIAuthorization: vi.fn(),
    revokeExternalAIAuthorization: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockListClients = orpc.listExternalAIClients as ReturnType<typeof vi.fn>;
const mockListAuthorizations = orpc.listExternalAIAuthorizations as ReturnType<typeof vi.fn>;
const mockCreateAuthorization = orpc.createExternalAIAuthorization as ReturnType<typeof vi.fn>;
const mockRevokeAuthorization = orpc.revokeExternalAIAuthorization as ReturnType<typeof vi.fn>;

const ExternalAIPage = Route.options.component as React.ComponentType;

function buildI18n() {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["translation", "common"],
    defaultNS: "translation",
    resources: {
      en: {
        translation: {},
        common: enCommon,
      },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={buildI18n()}>
        <ExternalAIPage />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListClients.mockResolvedValue({
    clients: [
      {
        id: "client-1",
        key: "anthropic_claude",
        title: "Anthropic Claude",
        description: "Claude",
        isActive: true,
      },
    ],
  });
  mockListAuthorizations.mockResolvedValue({
    authorizations: [
      {
        id: "auth-1",
        title: "My Claude",
        scopes: ["ai:context:read"],
        status: "active",
        lastUsedAt: null,
        expiresAt: "2026-04-20T10:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-04-10T10:00:00.000Z",
        client: {
          id: "client-1",
          key: "anthropic_claude",
          title: "Anthropic Claude",
          description: "Claude",
          isActive: true,
        },
      },
    ],
  });
  mockCreateAuthorization.mockResolvedValue({
    authorizationId: "auth-2",
    challengeId: "challenge-1",
    challengeCode: "secret-code",
    challengeExpiresAt: "2026-04-10T10:10:00.000Z",
    authorizationExpiresAt: "2026-05-10T10:00:00.000Z",
    accessTokenExpiresAt: "2026-04-10T18:00:00.000Z",
    scopes: ["ai:context:read"],
    client: {
      id: "client-1",
      key: "anthropic_claude",
      title: "Anthropic Claude",
      description: "Claude",
      isActive: true,
    },
  });
  mockRevokeAuthorization.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("External AI connections page", () => {
  it("renders existing authorizations", async () => {
    renderPage();

    expect(await screen.findByText("External AI Connections")).toBeInTheDocument();
    expect(await screen.findByText("My Claude")).toBeInTheDocument();
    expect(screen.getByText("Existing connections")).toBeInTheDocument();
  });

  it("creates a new authorization and shows the challenge code", async () => {
    renderPage();
    await screen.findByLabelText("External client");

    fireEvent.change(screen.getByLabelText("Connection label"), {
      target: { value: "Claude desktop" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create connection" }));

    expect(await screen.findByText(/One-time connection created for Anthropic Claude/)).toBeInTheDocument();
    expect(screen.getByText("secret-code")).toBeInTheDocument();
    expect(mockCreateAuthorization).toHaveBeenCalledWith({
      clientKey: "anthropic_claude",
      title: "Claude desktop",
    });
  });

  it("revokes an authorization", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(mockRevokeAuthorization).toHaveBeenCalledWith({ authorizationId: "auth-1" });
    });
  });
});
