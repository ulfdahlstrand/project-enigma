/**
 * Tests for /resumes/$id/history — Version History page.
 *
 * Acceptance criteria:
 *   - Loading spinner while graph query is pending
 *   - Empty state when selected branch has no commits
 *   - Renders branch-specific commit list
 *   - Supports branch selection and list/tree toggle
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
  beforeEach(() => {
    mockSearch = {};
    mockGetResumeBranchHistoryGraph.mockResolvedValue({
      ...GRAPH,
      commits: GRAPH.commits.filter((commit) => commit.id !== "commit-id-3"),
    });
  });

  it("renders the empty message when no commits exist", async () => {
    renderPage("branch-id-2");
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

  it("renders table headers", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText(enCommon.resume.history.tableHeaderMessage)).toBeInTheDocument();
    expect(within(table).getByText(enCommon.resume.history.tableHeaderSavedAt)).toBeInTheDocument();
  });

  it("renders commits reachable from the selected branch head, including ancestors", async () => {
    mockSearch = {};
    renderPage("branch-id-2");

    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Swedish version")).toBeInTheDocument();
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
    expect(within(table).queryByText("German version")).toBeNull();
  });

  it("falls back to the main branch when the search branch is unknown", async () => {
    mockSearch = {};
    renderPage("missing-branch");

    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
    expect(within(table).queryByText("Swedish version")).toBeNull();
  });

  it("renders commits with the newest saved version first", async () => {
    renderPage();

    const table = await screen.findByTestId("history-commit-table");
    const commitMessages = within(table).getAllByRole("row").slice(1).map((row) => row.textContent ?? "");
    expect(commitMessages[0]).toContain(enCommon.resume.history.defaultMessage);
    expect(commitMessages[1]).toContain("Initial version");
  });

  it("renders merged ancestor commits for the selected branch head", async () => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH_WITH_MERGE);
    renderPage();

    const table = await screen.findByTestId("history-commit-table");
    expect(within(table).getByText("Merge Swedish variant")).toBeInTheDocument();
    expect(within(table).getByText("Swedish version")).toBeInTheDocument();
    expect(within(table).getByText("Initial version")).toBeInTheDocument();
    expect(within(table).queryByText("German version")).toBeNull();
  });
});

describe("View controls", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders the filter bar above the split view", async () => {
    renderPage();
    expect(await screen.findByTestId("history-branch-filters")).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.compare.tree.filterLabel)).toBeInTheDocument();
  });

  it("navigates when a branch is selected in the sidebar", async () => {
    const user = userEvent.setup();
    mockSearch = {};
    renderPage();

    const sidebar = await screen.findByTestId("history-branch-sidebar");
    await user.click(within(sidebar).getByRole("option", { name: /Swedish Variant/i }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-2" },
    });
  });

  it("renders the graph with all branches and commits", async () => {
    renderPage();

    expect(await screen.findByTestId("history-graph")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-1")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-2")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-3")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-4")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-1")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-2")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-3")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-4")).toBeInTheDocument();
  });

  it("renders branch ancestry details in deterministic order", async () => {
    renderPage();

    const mainBranch = await screen.findByTestId("tree-branch-branch-id-1");
    const swedishBranch = screen.getByTestId("tree-branch-branch-id-2");
    const germanBranch = screen.getByTestId("tree-branch-branch-id-3");

    expect(mainBranch).toHaveAttribute("aria-label", "main");
    expect(swedishBranch).toHaveAttribute("aria-label", "Swedish Variant");
    expect(germanBranch).toHaveAttribute("aria-label", "German Variant");
    // Labels are visible in the graph row column
    const graph = screen.getByTestId("history-graph");
    expect(within(graph).queryByText("Initial version")).toBeInTheDocument();
    expect(within(graph).queryByText("Swedish version")).toBeInTheDocument();
    expect(within(graph).queryByText("German version")).toBeInTheDocument();
  });

  it("renders the no-commits branch state in tree mode", async () => {
    const user = userEvent.setup();
    renderPage("branch-id-4");

    const emptyBranch = await screen.findByTestId("tree-branch-branch-id-4");
    await user.hover(emptyBranch);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(enCommon.resume.history.treeNoCommits);
  });

  it("falls back to the first branch when no main branch exists", async () => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue({
      ...GRAPH,
      branches: GRAPH.branches.map((branch) => ({ ...branch, isMain: false })),
    });
    renderPage();

    const firstBranch = await screen.findByTestId("tree-branch-branch-id-1");
    expect(firstBranch).toHaveAttribute("aria-label", "main");
  });

  it("renders commit details only on hover in graph", async () => {
    const user = userEvent.setup();
    renderPage();

    const swedishCommit = await screen.findByTestId("tree-commit-commit-id-3");
    // Message is always visible as a row label; tooltip adds date/branch details on hover
    expect(screen.queryByText("Swedish version")).toBeInTheDocument();

    await user.hover(swedishCommit);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Swedish version");
    expect(screen.getByRole("tooltip")).toHaveTextContent(enCommon.resume.history.tableHeaderSavedAt);
  });

  it("renders branch details on hover in graph", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.hover(await screen.findByTestId("tree-branch-branch-id-2"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Swedish Variant");
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 snapshot");
  });
});

// ---------------------------------------------------------------------------
// Hybrid split view (#612)
// ---------------------------------------------------------------------------

describe("Hybrid split view", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders branch sidebar alongside the graph without a view toggle", async () => {
    renderPage();
    expect(await screen.findByTestId("history-branch-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("history-graph")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: enCommon.resume.history.listView })).toBeNull();
    expect(screen.queryByRole("button", { name: enCommon.resume.history.treeView })).toBeNull();
  });

  it("renders all branches in the sidebar", async () => {
    renderPage();
    const sidebar = await screen.findByTestId("history-branch-sidebar");
    expect(within(sidebar).getByText("main")).toBeInTheDocument();
    expect(within(sidebar).getByText("Swedish Variant")).toBeInTheDocument();
    expect(within(sidebar).getByText("German Variant")).toBeInTheDocument();
    expect(within(sidebar).getByText("Empty Variant")).toBeInTheDocument();
  });

  it("renders the commit table panel alongside the graph for the selected branch", async () => {
    renderPage();
    expect(await screen.findByTestId("history-graph")).toBeInTheDocument();
    expect(screen.getByTestId("history-commit-table")).toBeInTheDocument();
  });

  it("clicking a branch in the sidebar navigates to that branch", async () => {
    const user = userEvent.setup();
    mockSearch = {};
    renderPage();

    const sidebar = await screen.findByTestId("history-branch-sidebar");
    await user.click(within(sidebar).getByRole("option", { name: /Swedish Variant/i }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-2" },
    });
  });

  it("highlights the selected branch in the sidebar", async () => {
    mockSearch = { branchId: "branch-id-2" };
    renderPage();

    const sidebar = await screen.findByTestId("history-branch-sidebar");
    const selectedOption = within(sidebar).getByRole("option", { name: /Swedish Variant/i });
    expect(selectedOption).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Breadcrumb navigation", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders a breadcrumb link back to the resumes list", async () => {
    renderPage();
    await screen.findByTestId("history-branch-sidebar");
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
// New UX improvements
// ---------------------------------------------------------------------------

describe("UX improvements", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders the description text", async () => {
    renderPage();
    await screen.findByTestId("history-branch-sidebar");
    expect(screen.getByText(enCommon.resume.history.description)).toBeInTheDocument();
  });

  it("renders the View in resume button", async () => {
    renderPage();
    await screen.findByTestId("history-branch-sidebar");
    const btn = screen.getByRole("button", { name: enCommon.resume.history.viewInResumeButton });
    expect(btn).toBeInTheDocument();
  });

  it("navigates with branchId when View in resume is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("history-branch-sidebar");
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.viewInResumeButton }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-id-1", branchId: "branch-id-1" },
    });
  });

  it("opens an exact commit from the row actions menu", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId("history-commit-table");
    await user.click(screen.getAllByRole("button", { name: enCommon.resume.history.commitActionsButton })[0]!);
    await user.click(screen.getByRole("menuitem", { name: enCommon.resume.history.viewCommitMenuItem }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/commit/$commitId",
      params: { id: "resume-id-1", commitId: "commit-id-2" },
    });
  });

  it("renders the Compare versions button", async () => {
    renderPage();
    await screen.findByTestId("history-branch-sidebar");
    expect(screen.getByRole("button", { name: enCommon.resume.history.compareButton })).toBeInTheDocument();
  });

  it("navigates to compare with search params for the selected branch", async () => {
    const user = userEvent.setup();
    renderPage("branch-id-2");

    await screen.findByTestId("history-commit-table");
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.compareButton }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/compare",
      params: { id: "resume-id-1" },
      search: { baseRef: "main", compareRef: "Swedish Variant" },
    });
  });

  it("disables merge and delete actions for the main branch", async () => {
    renderPage();
    await screen.findByTestId("history-branch-sidebar");

    expect(screen.getByRole("button", { name: enCommon.resume.history.mergeButton })).toBeDisabled();
    expect(screen.getByRole("button", { name: enCommon.resume.history.deleteBranchButton })).toBeDisabled();
  });

  it("opens merge dialog and merges selected branch into chosen target branch", async () => {
    const user = userEvent.setup();
    mockSearch = {};
    renderPage("branch-id-2");

    await screen.findByTestId("history-commit-table");
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.mergeButton }));

    expect(screen.getByRole("heading", { name: enCommon.resume.history.mergeDialog.title })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: enCommon.resume.history.mergeDialog.title });
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(within(screen.getByRole("listbox")).getByText("German Variant"));
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.mergeDialog.confirm }));

    expect(mockFinaliseResumeBranch).toHaveBeenCalledWith({
      sourceBranchId: "branch-id-3",
      revisionBranchId: "branch-id-2",
      action: "merge",
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-3" },
    });
  });

  it("opens delete dialog and deletes the selected branch", async () => {
    const user = userEvent.setup();
    mockSearch = {};
    renderPage("branch-id-2");

    await screen.findByTestId("history-commit-table");
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.deleteBranchButton }));

    expect(screen.getByRole("heading", { name: enCommon.resume.history.deleteDialog.title })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.deleteDialog.confirm }));

    expect(mockDeleteResumeBranch).toHaveBeenCalledWith({ branchId: "branch-id-2" });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-1" },
    });
  });

  it("renders the head badge on the most recent commit", async () => {
    renderPage();
    const table = await screen.findByTestId("history-commit-table");
    const headBadges = within(table).getAllByText(enCommon.resume.history.headBadge);
    expect(headBadges.length).toBeGreaterThan(0);
  });

  it("opens an exact commit when clicking a commit in graph view", async () => {
    const user = userEvent.setup();
    mockSearch = {};
    renderPage();

    await user.click(await screen.findByTestId("tree-commit-commit-id-3"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/commit/$commitId",
      params: { id: "resume-id-1", commitId: "commit-id-3" },
    });
  });
});
