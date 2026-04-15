import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test-utils/render";
import { ResumeLanguageSwitcher } from "../ResumeLanguageSwitcher";

const mockNavigate = vi.fn();
let mockLocale: string | undefined = "sv";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ locale: mockLocale }),
  };
});

describe("ResumeLanguageSwitcher", () => {
  const RESUME_ID = "resume-id-1";
  const SUPPORTED_LANGUAGES = ["sv", "en"];

  beforeEach(() => {
    mockLocale = "sv";
    mockNavigate.mockReset();
  });

  it("renders a button for each supported language", () => {
    renderWithProviders(
      <ResumeLanguageSwitcher resumeId={RESUME_ID} supportedLanguages={SUPPORTED_LANGUAGES} />,
    );

    expect(screen.getByRole("button", { name: "SV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  it("marks the active locale button with aria-pressed=true", () => {
    mockLocale = "sv";
    renderWithProviders(
      <ResumeLanguageSwitcher resumeId={RESUME_ID} supportedLanguages={SUPPORTED_LANGUAGES} />,
    );

    expect(screen.getByRole("button", { name: "SV" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not render when only one language is supported", () => {
    const { container } = renderWithProviders(
      <ResumeLanguageSwitcher resumeId={RESUME_ID} supportedLanguages={["sv"]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when no locale is present in params", () => {
    mockLocale = undefined;
    const { container } = renderWithProviders(
      <ResumeLanguageSwitcher resumeId={RESUME_ID} supportedLanguages={SUPPORTED_LANGUAGES} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("calls navigate with the correct locale and resumeId when a language button is clicked", async () => {
    const user = userEvent.setup();
    mockLocale = "sv";
    renderWithProviders(
      <ResumeLanguageSwitcher resumeId={RESUME_ID} supportedLanguages={SUPPORTED_LANGUAGES} />,
    );

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/$locale/resumes/$id",
      params: { locale: "en", id: RESUME_ID },
    });
  });
});
