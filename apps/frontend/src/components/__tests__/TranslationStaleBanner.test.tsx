/**
 * Tests for TranslationStaleBanner component.
 *
 * The banner now opens the SyncDialog wizard which confirms a destructive
 * rebase of the translation onto the source's latest content.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { TranslationStaleBanner } from "../TranslationStaleBanner";

vi.mock("../../hooks/versioning", () => ({
  useRebaseTranslationOntoSource: vi.fn(),
}));

import { useRebaseTranslationOntoSource } from "../../hooks/versioning";
const mockUseRebase = useRebaseTranslationOntoSource as ReturnType<typeof vi.fn>;

function renderBanner() {
  return renderWithProviders(
    <TranslationStaleBanner
      resumeId="resume-1"
      branchId="translation-1"
      sourceName="English version"
    />,
    { queryClient: buildTestQueryClient() },
  );
}

afterEach(() => vi.clearAllMocks());

describe("render", () => {
  it("shows the warning banner and sync trigger", () => {
    mockUseRebase.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(
      screen.getByText(enCommon.resume.translationStaleBanner.title),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: enCommon.resume.translationStaleBanner.markCaughtUpButton,
      }),
    ).toBeInTheDocument();
  });
});

describe("sync flow", () => {
  it("opens wizard, advances, and calls rebase on confirm", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseRebase.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", {
        name: enCommon.resume.translationStaleBanner.markCaughtUpButton,
      }),
    );
    await user.click(screen.getByRole("button", { name: enCommon.resume.syncDialog.next }));
    await user.click(
      screen.getByRole("button", {
        name: enCommon.resume.syncDialog.translation.confirmButton,
      }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        branchId: "translation-1",
        resumeId: "resume-1",
      });
    });
  });

  it("shows a generic error when rebase fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network error"));
    mockUseRebase.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", {
        name: enCommon.resume.translationStaleBanner.markCaughtUpButton,
      }),
    );
    await user.click(screen.getByRole("button", { name: enCommon.resume.syncDialog.next }));
    await user.click(
      screen.getByRole("button", {
        name: enCommon.resume.syncDialog.translation.confirmButton,
      }),
    );

    expect(await screen.findByText(enCommon.resume.syncDialog.error)).toBeInTheDocument();
  });
});
