/**
 * Tests for RevisionsMenu component.
 *
 * Acceptance criteria:
 *   - Renders the Revisions button with no badge when there are no revisions
 *   - Renders a badge with the count when revisions exist
 *   - Shows "No active revisions" in the menu when there are none
 *   - Lists revision names in the menu when they exist
 *   - Navigates to a revision branch when one is clicked
 *   - Opens create dialog from menu
 *   - Create button disabled when name is empty
 *   - Calls mutateAsync and navigates on successful create
 *   - Shows error message when create fails
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { RevisionsMenu } from "../RevisionsMenu";

// ---------------------------------------------------------------------------
// Mock versioning hooks
// ---------------------------------------------------------------------------

vi.mock("../../hooks/versioning", () => ({
  useResumeBranches: vi.fn(),
  useCreateRevisionBranch: vi.fn(),
}));

import { useResumeBranches, useCreateRevisionBranch } from "../../hooks/versioning";
const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;
const mockUseCreateRevisionBranch = useCreateRevisionBranch as ReturnType<typeof vi.fn>;

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

const VARIANT_ID = "variant-1";

const REVISION_1 = {
  id: "revision-1",
  resumeId: "resume-1",
  name: "2026 rebrand",
  isMain: false,
  language: "sv",
  headCommitId: "commit-r1",
  createdAt: "2024-03-01T00:00:00Z",
  branchType: "revision" as const,
  sourceBranchId: VARIANT_ID,
  sourceCommitId: "commit-1",
  isStale: false,
};

const REVISION_2 = {
  id: "revision-2",
  resumeId: "resume-1",
  name: "Spotify-ansökan",
  isMain: false,
  language: "sv",
  headCommitId: "commit-r2",
  createdAt: "2024-03-02T00:00:00Z",
  branchType: "revision" as const,
  sourceBranchId: VARIANT_ID,
  sourceCommitId: "commit-1",
  isStale: false,
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderMenu() {
  return renderWithProviders(
    <RevisionsMenu resumeId="resume-1" variantBranchId={VARIANT_ID} />,
    { queryClient: buildTestQueryClient() },
  );
}

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Button appearance
// ---------------------------------------------------------------------------

describe("button appearance", () => {
  it("renders the Revisions button", () => {
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderMenu();
    expect(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label })).toBeInTheDocument();
  });

  it("shows no badge when there are no revisions", () => {
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderMenu();
    // MUI Badge renders the span with badge content only when badgeContent is truthy
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows a badge with the revision count", () => {
    mockUseResumeBranches.mockReturnValue({ data: [REVISION_1, REVISION_2] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderMenu();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Menu contents
// ---------------------------------------------------------------------------

describe("menu contents", () => {
  it("shows 'No active revisions' when there are none", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    expect(await screen.findByText(enCommon.resume.revisionsMenu.noRevisions)).toBeInTheDocument();
  });

  it("lists revision names when they exist", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [REVISION_1, REVISION_2] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    expect(await screen.findByRole("menuitem", { name: "2026 rebrand" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Spotify-ansökan" })).toBeInTheDocument();
  });

  it("navigates to a revision branch when clicked", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [REVISION_1] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    await user.click(await screen.findByRole("menuitem", { name: "2026 rebrand" }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "revision-1" },
    });
  });
});

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

describe("create dialog", () => {
  it("opens when 'Create revision' is clicked", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    await user.click(await screen.findByText(enCommon.resume.revisionsMenu.createRevision));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.revisionsMenu.createDialog.title)).toBeInTheDocument();
  });

  it("keeps Create button disabled when name is empty", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    await user.click(await screen.findByText(enCommon.resume.revisionsMenu.createRevision));
    expect(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.createDialog.create })).toBeDisabled();
  });

  it("calls mutateAsync and navigates on successful create", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "revision-3" });
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    await user.click(await screen.findByText(enCommon.resume.revisionsMenu.createRevision));
    await user.type(screen.getByLabelText(enCommon.resume.revisionsMenu.createDialog.nameLabel), "New revision");
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.createDialog.create }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        sourceBranchId: VARIANT_ID,
        name: "New revision",
        resumeId: "resume-1",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "revision-3" },
    });
  });

  it("shows error message when create fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network error"));
    mockUseResumeBranches.mockReturnValue({ data: [] });
    mockUseCreateRevisionBranch.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.label }));
    await user.click(await screen.findByText(enCommon.resume.revisionsMenu.createRevision));
    await user.type(screen.getByLabelText(enCommon.resume.revisionsMenu.createDialog.nameLabel), "Bad revision");
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionsMenu.createDialog.create }));

    expect(await screen.findByText(enCommon.resume.revisionsMenu.createDialog.error)).toBeInTheDocument();
  });
});
