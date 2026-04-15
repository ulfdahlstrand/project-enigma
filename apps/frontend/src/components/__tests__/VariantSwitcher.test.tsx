/**
 * Tests for VariantSwitcher component.
 *
 * Acceptance criteria:
 *   - Returns null when branches is undefined
 *   - Shows "Manage variants" link even with only one branch
 *   - Renders dropdown when there are multiple branches
 *   - Shows branch names as options
 *   - Navigates to /resumes/$id when a different branch is selected
 *   - Does not navigate when the current branch is re-selected
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { VariantSwitcher } from "../VariantSwitcher";

// ---------------------------------------------------------------------------
// Mock versioning hook
// ---------------------------------------------------------------------------

vi.mock("../../hooks/versioning", () => ({
  useResumeBranches: vi.fn(),
  useForkResumeBranch: vi.fn(),
}));

import { useForkResumeBranch, useResumeBranches } from "../../hooks/versioning";
const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;
const mockUseForkResumeBranch = useForkResumeBranch as ReturnType<typeof vi.fn>;
const defaultForkMutation = () => ({
  mutateAsync: vi.fn(),
  isPending: false,
});

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    createLink: (Comp: React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement>>) =>
      function MockRouterLink({ to, params, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: Record<string, string> }) {
        const href = to && params ? Object.entries(params).reduce((s, [k, v]) => s.replace(`$${k}`, v), to) : to;
        return <Comp href={href} {...props}>{children}</Comp>;
      },
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ONE_BRANCH = [
  { id: "branch-id-1", resumeId: "resume-id-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", createdAt: "2024-01-01T00:00:00Z", branchType: "variant" as const, sourceBranchId: null, sourceCommitId: null, isStale: false },
];

const TWO_BRANCHES = [
  { id: "branch-id-1", resumeId: "resume-id-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", createdAt: "2024-01-01T00:00:00Z", branchType: "variant" as const, sourceBranchId: null, sourceCommitId: null, isStale: false },
  { id: "branch-id-2", resumeId: "resume-id-1", name: "Swedish", isMain: false, language: "sv", headCommitId: "commit-2", createdAt: "2024-02-01T00:00:00Z", branchType: "variant" as const, sourceBranchId: null, sourceCommitId: null, isStale: false },
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderSwitcher(resumeId = "resume-id-1", currentBranchId: string | null = "branch-id-1") {
  const queryClient = buildTestQueryClient();
  return renderWithProviders(
    <VariantSwitcher resumeId={resumeId} currentBranchId={currentBranchId} />,
    { queryClient }
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

mockUseForkResumeBranch.mockReturnValue(defaultForkMutation());

// ---------------------------------------------------------------------------
// Hidden when not enough branches
// ---------------------------------------------------------------------------

describe("Hidden state", () => {
  it("renders nothing when branches is undefined", () => {
    mockUseResumeBranches.mockReturnValue({ data: undefined });
    const { container } = renderSwitcher();
    expect(container.firstChild).toBeNull();
  });
});

describe("Single branch state", () => {
  it("renders the dropdown even when there is only one branch", () => {
    mockUseResumeBranches.mockReturnValue({ data: ONE_BRANCH });
    renderSwitcher();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows manage variants option inside the dropdown when there is only one branch", async () => {
    mockUseResumeBranches.mockReturnValue({ data: ONE_BRANCH });
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText(enCommon.resume.variantSwitcher.manageVariants)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Visible with multiple branches
// ---------------------------------------------------------------------------

describe("Visible state", () => {
  it("renders the dropdown label when there are multiple branches", () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    renderSwitcher();
    // MUI InputLabel renders text in both a <label> and a legend <span>
    const labels = screen.getAllByText(enCommon.resume.variantSwitcher.label);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("renders a combobox element", () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    renderSwitcher();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows manage variants option inside the dropdown", async () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText(enCommon.resume.variantSwitcher.manageVariants)).toBeInTheDocument();
  });

  it("shows create variant option inside the dropdown", async () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText(enCommon.resume.variants.createButton)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Branch selection
// ---------------------------------------------------------------------------

describe("Branch selection", () => {
  it("navigates when a different branch is selected", async () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher("resume-id-1", "branch-id-1");

    // Open the select
    await user.click(screen.getByRole("combobox"));

    // Click the second branch option
    const option = await screen.findByRole("option", { name: /Swedish/ });
    await user.click(option);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-id-1", branchId: "branch-id-2" },
    });
  });

  it("does not navigate when the already-active branch is re-selected", async () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher("resume-id-1", "branch-id-1");

    // Open and click the already-active branch
    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: /main/ });
    await user.click(option);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("Create variant dialog", () => {
  it("opens from the dropdown and preselects the active branch as base", async () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher("resume-id-1", "branch-id-2");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: enCommon.resume.variants.createButton }));

    expect(screen.getByRole("heading", { name: enCommon.resume.variants.createDialog.title })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Swedish");
  });

  it("creates a branch from the selected base branch and navigates to it", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: "branch-id-3", headCommitId: "commit-3" });
    mockUseForkResumeBranch.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    const user = userEvent.setup();
    renderSwitcher("resume-id-1", "branch-id-2");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: enCommon.resume.variants.createButton }));

    await user.type(screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel), "New Variant");
    await user.click(screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create }));

    expect(mutateAsync).toHaveBeenCalledWith({
      fromCommitId: "commit-2",
      name: "New Variant",
      resumeId: "resume-id-1",
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-id-1", branchId: "branch-id-3" },
    });
  });
});
