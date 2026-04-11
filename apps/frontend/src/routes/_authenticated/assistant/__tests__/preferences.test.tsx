import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import enCommon from "../../../../locales/en/common.json";
import { AssistantPreferencesSection } from "../../../../features/settings/AssistantPreferencesSection";

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    getConsultantAIPreferences: vi.fn(),
    updateConsultantAIPreferences: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockGetPreferences = orpc.getConsultantAIPreferences as ReturnType<typeof vi.fn>;
const mockUpdatePreferences = orpc.updateConsultantAIPreferences as ReturnType<typeof vi.fn>;

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
        <AssistantPreferencesSection />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetPreferences.mockResolvedValue({
    preferences: {
      employeeId: "550e8400-e29b-41d4-a716-446655440011",
      prompt: "Prefer a concise senior tone.",
      rules: "Keep the writing factual.",
      validators: "Do not exaggerate scope.",
      updatedAt: "2026-04-10T10:00:00.000Z",
    },
  });
  mockUpdatePreferences.mockResolvedValue({
    preferences: {
      employeeId: "550e8400-e29b-41d4-a716-446655440011",
      prompt: "Prefer a concise senior tone.",
      rules: "Keep the writing factual and leadership-oriented.",
      validators: "Do not exaggerate scope.",
      updatedAt: "2026-04-10T11:00:00.000Z",
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Assistant preferences page", () => {
  it("renders stored consultant preferences", async () => {
    renderPage();

    expect(await screen.findByText("Assistant preferences")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Prefer a concise senior tone.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep the writing factual.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Do not exaggerate scope.")).toBeInTheDocument();
  });

  it("updates consultant preferences", async () => {
    renderPage();
    const rulesField = await screen.findByLabelText("Personal rules");

    fireEvent.change(rulesField, {
      target: { value: "Keep the writing factual and leadership-oriented." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        prompt: "Prefer a concise senior tone.",
        rules: "Keep the writing factual and leadership-oriented.",
        validators: "Do not exaggerate scope.",
      });
    });

    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
  });
});
