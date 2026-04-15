/**
 * Tests for TranslationStaleBanner component.
 *
 * Acceptance criteria:
 *   - Renders the warning banner with title and description
 *   - Shows "Mark as up to date" button
 *   - Calls mutateAsync with branchId and resumeId when button is clicked
 *   - Shows error message when markCaughtUp fails
 *   - Disables button while isPending is true
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { TranslationStaleBanner } from "../TranslationStaleBanner";

// ---------------------------------------------------------------------------
// Mock versioning hooks
// ---------------------------------------------------------------------------

vi.mock("../../hooks/versioning", () => ({
  useMarkTranslationCaughtUp: vi.fn(),
}));

import { useMarkTranslationCaughtUp } from "../../hooks/versioning";
const mockUseMarkCaughtUp = useMarkTranslationCaughtUp as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderBanner() {
  return renderWithProviders(
    <TranslationStaleBanner resumeId="resume-1" branchId="translation-1" />,
    { queryClient: buildTestQueryClient() },
  );
}

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

describe("render", () => {
  it("shows the warning banner title", () => {
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(screen.getByText(enCommon.resume.translationStaleBanner.title)).toBeInTheDocument();
  });

  it("shows the description text", () => {
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(screen.getByText(enCommon.resume.translationStaleBanner.description)).toBeInTheDocument();
  });

  it("shows the 'Mark as up to date' button", () => {
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(
      screen.getByRole("button", { name: enCommon.resume.translationStaleBanner.markCaughtUpButton }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Mark as caught up
// ---------------------------------------------------------------------------

describe("mark as caught up", () => {
  it("calls mutateAsync with correct args on button click", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.translationStaleBanner.markCaughtUpButton }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ branchId: "translation-1", resumeId: "resume-1" });
    });
  });

  it("shows error message when mutation fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network error"));
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.translationStaleBanner.markCaughtUpButton }),
    );

    expect(await screen.findByText(enCommon.resume.translationStaleBanner.error)).toBeInTheDocument();
  });

  it("disables the button when isPending is true", () => {
    mockUseMarkCaughtUp.mockReturnValue({ mutateAsync: vi.fn(), isPending: true });
    renderBanner();
    expect(
      screen.getByRole("button", { name: enCommon.resume.translationStaleBanner.markingCaughtUp }),
    ).toBeDisabled();
  });
});
