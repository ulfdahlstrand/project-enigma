/**
 * Tests for LanguageSwitcher component.
 *
 * Acceptance criteria:
 *   - Returns null when branches is undefined
 *   - In ghost mode: renders current language label as button
 *   - In ghost mode: opens menu on click, shows variant + translations + add option
 *   - In ghost mode: navigates when a different language is selected
 *   - In ghost mode: does not navigate when the current branch is re-selected
 *   - In ghost mode: opens create dialog when "Add translation" is clicked
 *   - Create dialog: disables Create button when no language is selected
 *   - Create dialog: calls mutateAsync and navigates on success
 *   - Create dialog: shows error message on failure
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { LanguageSwitcher } from "../LanguageSwitcher";

// ---------------------------------------------------------------------------
// Mock versioning hooks
// ---------------------------------------------------------------------------

vi.mock("../../hooks/versioning", () => ({
  useResumeBranches: vi.fn(),
  useCreateTranslationBranch: vi.fn(),
}));

import { useResumeBranches, useCreateTranslationBranch } from "../../hooks/versioning";
const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;
const mockUseCreateTranslationBranch = useCreateTranslationBranch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VARIANT = {
  id: "variant-1",
  resumeId: "resume-1",
  name: "main",
  isMain: true,
  language: "sv",
  headCommitId: "commit-1",
  createdAt: "2024-01-01T00:00:00Z",
  branchType: "variant" as const,
  sourceBranchId: null,
  sourceCommitId: null,
  isStale: false,
};

const TRANSLATION_EN = {
  id: "translation-en-1",
  resumeId: "resume-1",
  name: "main-en",
  isMain: false,
  language: "en",
  headCommitId: "commit-2",
  createdAt: "2024-02-01T00:00:00Z",
  branchType: "translation" as const,
  sourceBranchId: "variant-1",
  sourceCommitId: "commit-1",
  isStale: false,
};

const BRANCHES = [VARIANT, TRANSLATION_EN];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderSwitcher({
  currentBranchId = "variant-1",
  ghost = true,
}: {
  currentBranchId?: string | null;
  ghost?: boolean;
} = {}) {
  return renderWithProviders(
    <LanguageSwitcher
      resumeId="resume-1"
      currentBranchId={currentBranchId}
      variantBranchId="variant-1"
      ghost={ghost}
    />,
    { queryClient: buildTestQueryClient() },
  );
}

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Null state
// ---------------------------------------------------------------------------

describe("null state", () => {
  it("returns null when branches is undefined", () => {
    mockUseResumeBranches.mockReturnValue({ data: undefined });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const { container } = renderSwitcher();
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ghost mode — button and menu
// ---------------------------------------------------------------------------

describe("ghost mode — menu", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it("renders the current language as a button label", () => {
    renderSwitcher({ currentBranchId: "variant-1" });
    expect(screen.getByRole("button", { name: /sv/i })).toBeInTheDocument();
  });

  it("renders the translation language when a translation branch is active", () => {
    renderSwitcher({ currentBranchId: "translation-en-1" });
    expect(screen.getByRole("button", { name: /en/i })).toBeInTheDocument();
  });

  it("opens menu on click and shows variant, translation and add option", async () => {
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText(enCommon.resume.languageSwitcher.addTranslation)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sv/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /en/ })).toBeInTheDocument();
  });

  it("navigates when a different language is clicked", async () => {
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: /en/ }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "translation-en-1" },
    });
  });

  it("does not navigate when the already-active branch is re-selected", async () => {
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: /sv/ }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

describe("create dialog", () => {
  it("opens when 'Add translation' is clicked", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText(enCommon.resume.languageSwitcher.addTranslation));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.languageSwitcher.createDialog.title)).toBeInTheDocument();
  });

  it("keeps Create button disabled when no language is selected", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText(enCommon.resume.languageSwitcher.addTranslation));
    expect(screen.getByRole("button", { name: enCommon.resume.languageSwitcher.createDialog.create })).toBeDisabled();
  });

  it("calls mutateAsync and navigates on successful create", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "translation-sv-2" });
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText(enCommon.resume.languageSwitcher.addTranslation));

    // Select language via the dialog's select
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "en" }));

    await user.click(screen.getByRole("button", { name: enCommon.resume.languageSwitcher.createDialog.create }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        sourceBranchId: "variant-1",
        language: "en",
        resumeId: "resume-1",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "translation-sv-2" },
    });
  });

  it("shows error message when create fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network error"));
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES });
    mockUseCreateTranslationBranch.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderSwitcher({ currentBranchId: "variant-1" });

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText(enCommon.resume.languageSwitcher.addTranslation));

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "en" }));
    await user.click(screen.getByRole("button", { name: enCommon.resume.languageSwitcher.createDialog.create }));

    expect(await screen.findByText(enCommon.resume.languageSwitcher.createDialog.error)).toBeInTheDocument();
  });
});
