/**
 * Tests for /resumes/$id/compare — Compare Versions page.
 *
 * Acceptance criteria:
 *   - Loading spinner while commits are loading
 *   - Renders two version dropdowns
 *   - "No changes" alert when diff has no changes
 *   - Renders scalar changes section
 *   - Renders skills diff section
 *   - Renders assignments diff section
 *   - Error alert when diff fetch fails
 *   - Back button navigates to /resumes/$id
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

import enCommon from "../../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../../test-utils/render";
import { Route } from "../compare/index";
import {
  parseCompareRange,
  resolveCompareRefToCommitId,
} from "../compare/CompareVersionsPage";

// ---------------------------------------------------------------------------
// Mock diff hook
// ---------------------------------------------------------------------------

vi.mock("../../../../../hooks/versioning", () => ({
  useResumeBranches: vi.fn(),
  useResumeBranchHistoryGraph: vi.fn(),
  useResumeCommitDiff: vi.fn(),
  useArchiveResumeBranch: vi.fn(() => ({ mutate: vi.fn() })),
}));

import {
  useResumeBranches,
  useResumeBranchHistoryGraph,
  useResumeCommitDiff,
} from "../../../../../hooks/versioning";

const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;
const mockUseResumeBranchHistoryGraph = useResumeBranchHistoryGraph as ReturnType<typeof vi.fn>;
const mockUseDiff = useResumeCommitDiff as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockParams = { current: { id: "resume-id-1" } as { id: string; range?: string } };

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams.current,
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return <a href={to} ref={ref} {...props}>{children}</a>;
    }),
  };
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BRANCH_DEFAULTS = {
  createdBy: null,
  sourceBranchId: null,
  sourceCommitId: null,
  branchType: "variant" as const,
  isStale: false,
  isArchived: false,
};

const BRANCHES = [
  {
    ...BRANCH_DEFAULTS,
    id: "branch-id-1",
    resumeId: "resume-id-1",
    name: "main",
    language: "en",
    isMain: true,
    headCommitId: "commit-id-1",
    forkedFromCommitId: null,
    createdAt: "2024-06-01T10:00:00Z",
  },
  {
    ...BRANCH_DEFAULTS,
    id: "branch-id-2",
    resumeId: "resume-id-1",
    name: "qwerty",
    language: "en",
    isMain: false,
    headCommitId: "commit-id-2",
    forkedFromCommitId: "commit-id-1",
    createdAt: "2024-06-02T10:00:00Z",
  },
];

const COMMITS = [
  {
    id: "commit-id-1",
    resumeId: "resume-id-1",
    parentCommitId: null,
    message: "Version A",
    title: "Version A",
    description: "",
    createdBy: null,
    createdAt: "2024-06-01T10:00:00Z",
  },
  {
    id: "commit-id-2",
    resumeId: "resume-id-1",
    parentCommitId: "commit-id-1",
    message: "Version B",
    title: "Version B",
    description: "",
    createdBy: null,
    createdAt: "2024-06-02T10:00:00Z",
  },
];

const GRAPH = {
  branches: BRANCHES,
  commits: COMMITS,
  edges: [{ commitId: "commit-id-2", parentCommitId: "commit-id-1", parentOrder: 0 }],
};

const NO_CHANGES_DIFF = {
  baseCommitId: "commit-id-1",
  headCommitId: "commit-id-2",
  diff: { scalars: {}, skills: [], assignments: [], hasChanges: false },
};

const HAS_CHANGES_DIFF = {
  baseCommitId: "commit-id-1",
  headCommitId: "commit-id-2",
  diff: {
    hasChanges: true,
    scalars: {
      title: { before: "Old Title", after: "New Title" },
    },
    skills: [
      { status: "added", name: "TypeScript", before: undefined, after: { name: "TypeScript", category: "Languages", level: 4 } },
      { status: "removed", name: "Java", before: { name: "Java", category: "Languages", level: 3 }, after: undefined },
    ],
    assignments: [
      {
        status: "modified",
        assignmentId: "550e8400-e29b-41d4-a716-446655440001",
        before: { assignmentId: "550e8400-e29b-41d4-a716-446655440001", clientName: "Acme Corp", role: "Dev", startDate: "2023-01", endDate: null, description: [], technologies: [], keywords: [], highlight: false, sortOrder: 0 },
        after: { assignmentId: "550e8400-e29b-41d4-a716-446655440001", clientName: "Acme Corp", role: "Senior Dev", startDate: "2023-01", endDate: null, description: [], technologies: [], keywords: [], highlight: false, sortOrder: 0 },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const ComparePage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return { ...renderWithProviders(<ComparePage />, { queryClient }), queryClient };
}

afterEach(() => {
  vi.clearAllMocks();
  mockParams.current = { id: "resume-id-1" };
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar while commits are loading", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: undefined, isLoading: true });
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderPage();
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Version dropdowns
// ---------------------------------------------------------------------------

describe("Version dropdowns", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it("renders From dropdown label", async () => {
    renderPage();
    // MUI InputLabel renders text in both a <label> and a legend <span>
    const labels = await screen.findAllByText(enCommon.resume.compare.fromLabel);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("renders To dropdown label", async () => {
    renderPage();
    const labels = await screen.findAllByText(enCommon.resume.compare.toLabel);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("renders page title", async () => {
    renderPage();
    const title = await screen.findByRole("heading", { level: 1, name: enCommon.resume.compare.pageTitle });
    expect(title).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// No changes
// ---------------------------------------------------------------------------

describe("No changes diff", () => {
  it("renders the no-changes alert", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: NO_CHANGES_DIFF, isLoading: false, isError: false });

    renderPage();

    const alert = await screen.findByText(enCommon.resume.compare.noChanges);
    expect(alert).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Has changes
// ---------------------------------------------------------------------------

describe("Diff with changes", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: HAS_CHANGES_DIFF, isLoading: false, isError: false });
  });

  it("renders the scalars heading", async () => {
    renderPage();
    const heading = await screen.findByText(enCommon.resume.compare.scalarsHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders the skills heading", async () => {
    renderPage();
    const heading = await screen.findByText(enCommon.resume.compare.skillsHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders the assignments heading", async () => {
    renderPage();
    const heading = await screen.findByText(enCommon.resume.compare.assignmentsHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders a changed groups summary", async () => {
    renderPage();
    expect(
      await screen.findByText(enCommon.resume.compare.changedGroups_other.replace("{{count}}", "3"))
    ).toBeInTheDocument();
  });

  it("shows diff content when a group is expanded", async () => {
    renderPage();
    expect(await screen.findByText("title")).toBeInTheDocument();
    expect((await screen.findAllByText(enCommon.resume.compare.statusModified)).length).toBeGreaterThan(0);
  });

  it("uses the summary diff view by default and lets the user switch to split view", async () => {
    renderPage();

    const summaryToggle = await screen.findByRole("button", { name: enCommon.resume.compare.summaryView });
    expect(summaryToggle).toHaveAttribute("aria-pressed", "true");

    const splitToggle = screen.getByRole("button", { name: enCommon.resume.compare.splitView });
    fireEvent.click(splitToggle);

    expect(splitToggle).toHaveAttribute("aria-pressed", "true");
    expect(summaryToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("renders added skill chip with the skill name", async () => {
    renderPage();
    const addedChip = await screen.findByText(enCommon.resume.compare.statusAdded);
    expect(addedChip).toBeInTheDocument();
    const skillNames = await screen.findAllByText("TypeScript");
    expect(skillNames.length).toBeGreaterThan(0);
  });

  it("renders removed skill chip", async () => {
    renderPage();
    const removedChip = await screen.findByText(enCommon.resume.compare.statusRemoved);
    expect(removedChip).toBeInTheDocument();
  });

  it("renders modified assignment chip", async () => {
    renderPage();
    const modifiedChips = await screen.findAllByText(enCommon.resume.compare.statusModified);
    expect(modifiedChips.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("renders an error alert when diff fetch fails", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderPage();

    const errorMsg = await screen.findByText(enCommon.resume.compare.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Breadcrumb navigation", () => {
  it("renders a breadcrumb link back to the resumes list", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    renderPage();

    await screen.findByRole("heading", { level: 1, name: enCommon.resume.compare.pageTitle });
    const resumesLink = screen.getByRole("link", { name: enCommon.resume.pageTitle });
    expect(resumesLink).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UX improvements
// ---------------------------------------------------------------------------

describe("UX improvements", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false });
    mockUseResumeBranchHistoryGraph.mockReturnValue({ data: GRAPH, isLoading: false });
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it("renders the description text", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: enCommon.resume.compare.pageTitle });
    expect(screen.getByText(enCommon.resume.compare.description)).toBeInTheDocument();
  });

  it("renders the hint text when no versions are selected", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: enCommon.resume.compare.pageTitle });
    expect(screen.getByText(enCommon.resume.compare.noSelectionHint)).toBeInTheDocument();
  });
});

describe("Range route resolution", () => {
  it("parses GitHub-like compare ranges", () => {
    expect(parseCompareRange("main...qwerty")).toEqual({
      baseRef: "main",
      compareRef: "qwerty",
    });
  });

  it("resolves branch names to their head commit ids", () => {
    expect(resolveCompareRefToCommitId("main", BRANCHES, COMMITS)).toBe("commit-id-1");
    expect(resolveCompareRefToCommitId("qwerty", BRANCHES, COMMITS)).toBe("commit-id-2");
  });

  it("resolves mixed branch and commit refs", () => {
    expect(resolveCompareRefToCommitId("main", BRANCHES, COMMITS)).toBe("commit-id-1");
    expect(resolveCompareRefToCommitId("commit-id-2", BRANCHES, COMMITS)).toBe("commit-id-2");
  });
});
