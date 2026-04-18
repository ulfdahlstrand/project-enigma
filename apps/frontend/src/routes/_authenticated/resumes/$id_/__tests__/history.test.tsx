/**
 * Tests for /resumes/$id/history — Version History page.
 *
 * Acceptance criteria:
 *   - Loading spinner while graph query is pending
 *   - Empty state when no commits match the current filter
 *   - Renders commit list with inline graph column
 *   - Filter sidebar filters commits by branch and type
 *   - Toolbar actions: compare, merge, delete
 *   - Back button navigates to /resumes/$id
 *   - Error state when graph fetch fails
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../../test-utils/render";
import { VersionHistoryPage } from "../history/index";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../../../orpc-client", () => ({
  orpc: {
    getResumeBranchHistoryGraph: vi.fn(),
    listCommitTags: vi.fn(() => Promise.resolve([])),
    finaliseResumeBranch: vi.fn(),
    deleteResumeBranch: vi.fn(),
    archiveResumeBranch: vi.fn(),
  },
}));

import { orpc } from "../../../../../orpc-client";

const mockGetResumeBranchHistoryGraph = orpc.getResumeBranchHistoryGraph as ReturnType<typeof vi.fn>;
const mockFinaliseResumeBranch = orpc.finaliseResumeBranch as ReturnType<typeof vi.fn>;
const mockDeleteResumeBranch = orpc.deleteResumeBranch as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockSearch: { branchId?: string } = {};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useRouterState: () => ({ location: { pathname: "/resumes/resume-id-1/history" } }),
    useParams: () => ({ id: "resume-id-1" }),
    useSearch: () => mockSearch,
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

const GRAPH = {
  branches: [
    {
      ...BRANCH_DEFAULTS,
      id: "branch-id-1",
      resumeId: "resume-id-1",
      name: "main",
      language: "en",
      isMain: true,
      headCommitId: "commit-id-2",
      forkedFromCommitId: null,
      createdAt: "2024-06-01T09:00:00Z",
    },
    {
      ...BRANCH_DEFAULTS,
      id: "branch-id-2",
      resumeId: "resume-id-1",
      name: "Swedish Variant",
      language: "sv",
      isMain: false,
      headCommitId: "commit-id-3",
      forkedFromCommitId: "commit-id-1",
      createdAt: "2024-06-03T09:00:00Z",
    },
    {
      ...BRANCH_DEFAULTS,
      id: "branch-id-3",
      resumeId: "resume-id-1",
      name: "German Variant",
      language: "de",
      isMain: false,
      headCommitId: "commit-id-4",
      forkedFromCommitId: "commit-id-3",
      createdAt: "2024-06-04T09:00:00Z",
    },
    {
      ...BRANCH_DEFAULTS,
      id: "branch-id-4",
      resumeId: "resume-id-1",
      name: "Empty Variant",
      language: "fr",
      isMain: false,
      headCommitId: null,
      forkedFromCommitId: "commit-id-2",
      createdAt: "2024-06-05T09:00:00Z",
    },
  ],
  commits: [
    {
      id: "commit-id-1",
      resumeId: "resume-id-1",
      parentCommitId: null,
      title: "Initial version",
      description: "",
      createdAt: "2024-06-01T10:00:00Z",
    },
    {
      id: "commit-id-2",
      resumeId: "resume-id-1",
      parentCommitId: "commit-id-1",
      title: "",
      description: "",
      createdAt: "2024-06-02T10:00:00Z",
    },
    {
      id: "commit-id-3",
      resumeId: "resume-id-1",
      parentCommitId: "commit-id-1",
      title: "Swedish version",
      description: "",
      createdAt: "2024-06-03T10:00:00Z",
    },
    {
      id: "commit-id-4",
      resumeId: "resume-id-1",
      parentCommitId: "commit-id-3",
      title: "German version",
      description: "",
      createdAt: "2024-06-04T10:00:00Z",
    },
  ],
  edges: [
    { commitId: "commit-id-2", parentCommitId: "commit-id-1", parentOrder: 0 },
    { commitId: "commit-id-3", parentCommitId: "commit-id-1", parentOrder: 0 },
    { commitId: "commit-id-4", parentCommitId: "commit-id-3", parentOrder: 0 },
  ],
};

const GRAPH_WITH_MERGE = {
  ...GRAPH,
  branches: GRAPH.branches.map((branch) =>
    branch.id === "branch-id-1"
      ? { ...branch, headCommitId: "commit-id-5" }
      : branch
  ),
  commits: [
    {
      id: "commit-id-5",
      resumeId: "resume-id-1",
      parentCommitId: "commit-id-2",
      title: "Merge Swedish variant",
      description: "",
      createdAt: "2024-06-05T10:00:00Z",
    },
    ...GRAPH.commits,
  ],
  edges: [
    { commitId: "commit-id-5", parentCommitId: "commit-id-2", parentOrder: 0 },
    { commitId: "commit-id-5", parentCommitId: "commit-id-3", parentOrder: 1 },
    ...GRAPH.edges,
  ],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage(forcedBranchId?: string) {
  if (forcedBranchId) {
    mockSearch = { ...mockSearch, branchId: forcedBranchId };
  }
  const queryClient = buildTestQueryClient();
  return {
    ...renderWithProviders(<VersionHistoryPage />, { queryClient }),
    queryClient,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  mockSearch = {};
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar while commits are loading", () => {
    mockGetResumeBranchHistoryGraph.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Empty state", () => {
  it("renders the empty message when no commits exist", async () => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue({ ...GRAPH, commits: [], edges: [] });
    renderPage();
    const msg = await screen.findByText(enCommon.resume.history.empty);
    expect(msg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Commit list
// ---------------------------------------------------------------------------

describe("Commit list", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
    mockFinaliseResumeBranch.mockResolvedValue({ resultBranchId: "branch-id-1" });
    mockDeleteResumeBranch.mockResolvedValue({ deleted: true });
  });

  it("renders the page title", async () => {
    renderPage();
    const title = await screen.findByRole("heading", { level: 1, name: enCommon.resume.history.pageTitle });
    expect(title).toBeInTheDocument();
  });

  it("renders the commit message for the first commit", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
  });

  it("renders the default message for commits without a message", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText(enCommon.resume.history.defaultMessage)).toBeInTheDocument();
  });

  it("renders the message column header", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText(enCommon.resume.history.tableHeaderMessage)).toBeInTheDocument();
  });

  it("renders all commits by default (unfiltered)", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
    expect(within(table).getByText("Swedish version")).toBeInTheDocument();
    expect(within(table).getByText("German version")).toBeInTheDocument();
  });

  it("renders commits with the newest saved version first", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    const commitMessages = within(table).getAllByRole("row").slice(1).map((row) => row.textContent ?? "");
    // German version is newest (2024-06-04), default message (2024-06-02) is second newest
    expect(commitMessages[0]).toContain("German version");
  });

  it("renders merged ancestor commits", async () => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH_WITH_MERGE);
    renderPage();

    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Merge Swedish variant")).toBeInTheDocument();
    expect(within(table).getByText("Swedish version")).toBeInTheDocument();
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Filter sidebar
// ---------------------------------------------------------------------------

describe("Filter sidebar", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders the filter sidebar", async () => {
    renderPage();
    expect(await screen.findByTestId("history-filter-sidebar")).toBeInTheDocument();
  });

  it("shows all branches as filter options", async () => {
    renderPage();
    const sidebar = await screen.findByTestId("history-filter-sidebar");
    expect(within(sidebar).getByText("main")).toBeInTheDocument();
    expect(within(sidebar).getByText("Swedish Variant")).toBeInTheDocument();
    expect(within(sidebar).getByText("German Variant")).toBeInTheDocument();
    expect(within(sidebar).getByText("Empty Variant")).toBeInTheDocument();
  });

  it("filters commits to only those reachable from the selected branch after clicking a branch filter", async () => {
    const user = userEvent.setup();
    renderPage();

    const sidebar = await screen.findByTestId("history-filter-sidebar");
    await user.click(within(sidebar).getByText("Swedish Variant"));

    const table = screen.getByTestId("history-commit-table");
    expect(within(table).getByText("Swedish version")).toBeInTheDocument();
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
    expect(within(table).queryByText("German version")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Breadcrumb navigation
// ---------------------------------------------------------------------------

describe("Breadcrumb navigation", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders a breadcrumb link back to the resumes list", async () => {
    renderPage();
    await screen.findByTestId("history-commit-table");
    const resumesLink = screen.getByRole("link", { name: enCommon.resume.pageTitle });
    expect(resumesLink).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("renders an error alert when commits fetch fails", async () => {
    mockGetResumeBranchHistoryGraph.mockRejectedValue(new Error("Server error"));
    renderPage();
    const errorMsg = await screen.findByText(enCommon.resume.history.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

describe("Toolbar actions", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
    mockFinaliseResumeBranch.mockResolvedValue({ resultBranchId: "branch-id-1" });
    mockDeleteResumeBranch.mockResolvedValue({ deleted: true });
  });

  it("renders the head badge on the most recent commit of the selected branch", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    const headBadges = within(table).getAllByText(enCommon.resume.history.headBadge);
    expect(headBadges.length).toBeGreaterThan(0);
  });

  it("opens an exact commit from the row actions menu", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId("history-commit-table");
    await user.click(screen.getAllByRole("button", { name: enCommon.resume.history.commitActionsButton })[0]!);
    await user.click(await screen.findByRole("menuitem", { name: enCommon.resume.history.viewCommitMenuItem }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/commit/$commitId",
      params: { id: "resume-id-1", commitId: expect.any(String) },
    });
  });

});
