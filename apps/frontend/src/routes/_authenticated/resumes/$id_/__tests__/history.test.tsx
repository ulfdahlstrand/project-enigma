/**
 * Tests for /resumes/$id/history — Version History page.
 *
 * Acceptance criteria:
 *   - Loading spinner while queries are pending
 *   - Empty state when no commits exist
 *   - Renders commit list (message + date)
 *   - Default message for commits without a message
 *   - Back button navigates to /resumes/$id
 *   - Error state when commits fetch fails
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
    getResume: vi.fn(),
    listResumeCommits: vi.fn(),
  },
}));

import { orpc } from "../../../../../orpc-client";

const mockGetResume = orpc.getResume as ReturnType<typeof vi.fn>;
const mockListCommits = orpc.listResumeCommits as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "resume-id-1" }),
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

const RESUME = {
  id: "resume-id-1",
  mainBranchId: "branch-id-1",
  title: "My Resume",
  language: "en",
};

const COMMITS = [
  {
    id: "commit-id-1",
    branchId: "branch-id-1",
    message: "Initial version",
    createdAt: "2024-06-01T10:00:00Z",
    createdByEmployeeId: "emp-1",
  },
  {
    id: "commit-id-2",
    branchId: "branch-id-1",
    message: null,
    createdAt: "2024-06-02T10:00:00Z",
    createdByEmployeeId: "emp-1",
  },
];

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
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar while commits are loading", () => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Empty state", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue([]);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Back button", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockRejectedValue(new Error("Server error"));
    renderPage();
    const errorMsg = await screen.findByText(enCommon.resume.history.error);
    expect(errorMsg).toBeInTheDocument();
  });
});
