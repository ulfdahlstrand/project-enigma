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
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../../test-utils/render";
import { Route } from "../history/index";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../../../orpc-client", () => ({
  orpc: {
    getResumeBranchHistoryGraph: vi.fn(),
  },
}));

import { orpc } from "../../../../../orpc-client";

const mockGetResumeBranchHistoryGraph = orpc.getResumeBranchHistoryGraph as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockSearch: { branchId?: string; view?: "list" | "tree" } = {};

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

const GRAPH = {
  branches: [
    {
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
      id: "branch-id-3",
      resumeId: "resume-id-1",
      name: "German Variant",
      language: "de",
      isMain: false,
      headCommitId: "commit-id-4",
      forkedFromCommitId: "commit-id-3",
      createdAt: "2024-06-04T09:00:00Z",
    },
  ],
  commits: [
    {
      id: "commit-id-1",
      resumeId: "resume-id-1",
      branchId: "branch-id-1",
      parentCommitId: null,
      message: "Initial version",
      createdAt: "2024-06-01T10:00:00Z",
    },
    {
      id: "commit-id-2",
      resumeId: "resume-id-1",
      branchId: "branch-id-1",
      parentCommitId: "commit-id-1",
      message: "",
      createdAt: "2024-06-02T10:00:00Z",
    },
    {
      id: "commit-id-3",
      resumeId: "resume-id-1",
      branchId: "branch-id-2",
      parentCommitId: "commit-id-1",
      message: "Swedish version",
      createdAt: "2024-06-03T10:00:00Z",
    },
    {
      id: "commit-id-4",
      resumeId: "resume-id-1",
      branchId: "branch-id-3",
      parentCommitId: "commit-id-3",
      message: "German version",
      createdAt: "2024-06-04T10:00:00Z",
    },
  ],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const HistoryPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return { ...renderWithProviders(<HistoryPage />, { queryClient }), queryClient };
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
    mockSearch = { branchId: "branch-id-2", view: "list" };
    mockGetResumeBranchHistoryGraph.mockResolvedValue({
      ...GRAPH,
      commits: GRAPH.commits.filter((commit) => commit.branchId !== "branch-id-2"),
    });
  });

  it("renders the empty message when no commits exist", async () => {
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
  });

  it("renders the page title", async () => {
    renderPage();
    const title = await screen.findByText(enCommon.resume.history.pageTitle);
    expect(title).toBeInTheDocument();
  });

  it("renders the commit message for the first commit", async () => {
    renderPage();
    const msg = await screen.findByText("Initial version");
    expect(msg).toBeInTheDocument();
  });

  it("renders the default message for commits without a message", async () => {
    renderPage();
    const defaultMsg = await screen.findByText(enCommon.resume.history.defaultMessage);
    expect(defaultMsg).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    renderPage();
    await screen.findByText("Initial version");
    expect(screen.getByText(enCommon.resume.history.tableHeaderMessage)).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.history.tableHeaderSavedAt)).toBeInTheDocument();
  });

  it("renders only commits for the selected branch", async () => {
    mockSearch = { branchId: "branch-id-2", view: "list" };
    renderPage();

    expect(await screen.findByText("Swedish version")).toBeInTheDocument();
    expect(screen.queryByText("Initial version")).toBeNull();
  });
});

describe("View controls", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("renders the branch selector", async () => {
    renderPage();
    expect(await screen.findByText(enCommon.resume.history.branchLabel)).toBeInTheDocument();
  });

  it("navigates when a different branch is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Initial version");
    await user.click(screen.getByLabelText(enCommon.resume.history.branchLabel));
    await user.click(screen.getByText("Swedish Variant"));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-2", view: "list" },
    });
  });

  it("renders the tree overview mode", async () => {
    mockSearch = { view: "tree", branchId: "branch-id-1" };
    renderPage();

    expect(await screen.findByText(enCommon.resume.history.treeHeadLabel)).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.history.treeBaseLabel)).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.history.mainBranchTag)).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.history.currentBranchTag)).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-1")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-2")).toBeInTheDocument();
    expect(screen.getByTestId("tree-branch-branch-id-3")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-1")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-2")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-3")).toBeInTheDocument();
    expect(screen.getByTestId("tree-commit-commit-id-4")).toBeInTheDocument();
  });

  it("renders branch ancestry details in deterministic order", async () => {
    mockSearch = { view: "tree", branchId: "branch-id-1" };
    renderPage();

    const mainBranch = await screen.findByTestId("tree-branch-branch-id-1");
    const swedishBranch = screen.getByTestId("tree-branch-branch-id-2");
    const germanBranch = screen.getByTestId("tree-branch-branch-id-3");
    const mainCommit = await screen.findByTestId("tree-commit-commit-id-1");
    const updatedCommit = screen.getByTestId("tree-commit-commit-id-2");
    const swedishCommit = screen.getByTestId("tree-commit-commit-id-3");
    const germanCommit = screen.getByTestId("tree-commit-commit-id-4");

    expect(mainBranch).toHaveTextContent("main");
    expect(swedishBranch).toHaveTextContent("Based on: Initial version");
    expect(germanBranch).toHaveTextContent("Based on: Swedish version");
    expect(mainCommit).toHaveTextContent("Initial version");
    expect(updatedCommit).toHaveTextContent("commit-id-2");
    expect(swedishCommit).toHaveTextContent("Swedish version");
    expect(germanCommit).toHaveTextContent("German version");
  });

  it("navigates when tree view is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Initial version");
    await user.click(screen.getByRole("button", { name: enCommon.resume.history.treeView }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/history",
      params: { id: "resume-id-1" },
      search: { branchId: "branch-id-1", view: "tree" },
    });
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Back button", () => {
  beforeEach(() => {
    mockGetResumeBranchHistoryGraph.mockResolvedValue(GRAPH);
  });

  it("navigates to /resumes/$id when back button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const backBtn = await screen.findByText(enCommon.resume.detail.backButton);
    await user.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id",
      params: { id: "resume-id-1" },
    });
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
