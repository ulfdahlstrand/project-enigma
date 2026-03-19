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
}));

import { useResumeBranches } from "../../hooks/versioning";
const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;

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
  { id: "branch-id-1", resumeId: "resume-id-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", createdAt: "2024-01-01T00:00:00Z" },
];

const TWO_BRANCHES = [
  { id: "branch-id-1", resumeId: "resume-id-1", name: "main", isMain: true, language: "en", headCommitId: "commit-1", createdAt: "2024-01-01T00:00:00Z" },
  { id: "branch-id-2", resumeId: "resume-id-1", name: "Swedish", isMain: false, language: "sv", headCommitId: "commit-2", createdAt: "2024-02-01T00:00:00Z" },
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
  it("shows manage variants link when there is only one branch", () => {
    mockUseResumeBranches.mockReturnValue({ data: ONE_BRANCH });
    renderSwitcher();
    expect(screen.getByText(enCommon.resume.variantSwitcher.manageVariants)).toBeInTheDocument();
  });

  it("does not render the dropdown when there is only one branch", () => {
    mockUseResumeBranches.mockReturnValue({ data: ONE_BRANCH });
    renderSwitcher();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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

  it("shows manage variants link alongside the dropdown", () => {
    mockUseResumeBranches.mockReturnValue({ data: TWO_BRANCHES });
    renderSwitcher();
    expect(screen.getByText(enCommon.resume.variantSwitcher.manageVariants)).toBeInTheDocument();
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
      to: "/resumes/$id",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-2" },
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
