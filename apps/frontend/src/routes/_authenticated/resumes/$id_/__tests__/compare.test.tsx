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
import { screen } from "@testing-library/react";

import enCommon from "../../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../../test-utils/render";
import { Route } from "../compare/index";

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
// Mock diff hook
// ---------------------------------------------------------------------------

const mockDiffData = { current: undefined as unknown };
const mockDiffIsLoading = { current: false };
const mockDiffIsError = { current: false };

vi.mock("../../../../../hooks/versioning", () => ({
  resumeCommitsKey: (branchId: string) => ["listResumeCommits", branchId],
  useResumeCommitDiff: vi.fn(),
}));

import { useResumeCommitDiff } from "../../../../../hooks/versioning";
const mockUseDiff = useResumeCommitDiff as ReturnType<typeof vi.fn>;

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

const RESUME = { id: "resume-id-1", mainBranchId: "branch-id-1", title: "My Resume" };

const COMMITS = [
  { id: "commit-id-1", branchId: "branch-id-1", message: "Version A", createdAt: "2024-06-01T10:00:00Z" },
  { id: "commit-id-2", branchId: "branch-id-1", message: "Version B", createdAt: "2024-06-02T10:00:00Z" },
];

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
  mockDiffData.current = undefined;
  mockDiffIsLoading.current = false;
  mockDiffIsError.current = false;
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar while commits are loading", async () => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockReturnValue(new Promise(() => undefined));
    mockUseDiff.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderPage();
    // Progressbar appears after resume resolves and commits query starts (async)
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Version dropdowns
// ---------------------------------------------------------------------------

describe("Version dropdowns", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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

  it("renders added skill chip with the skill name", async () => {
    renderPage();
    const addedChip = await screen.findByText(enCommon.resume.compare.statusAdded);
    expect(addedChip).toBeInTheDocument();
    const skillName = await screen.findByText("TypeScript");
    expect(skillName).toBeInTheDocument();
  });

  it("renders removed skill chip", async () => {
    renderPage();
    const removedChip = await screen.findByText(enCommon.resume.compare.statusRemoved);
    expect(removedChip).toBeInTheDocument();
  });

  it("renders modified assignment chip", async () => {
    renderPage();
    const modifiedChip = await screen.findByText(enCommon.resume.compare.statusModified);
    expect(modifiedChip).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("renders an error alert when diff fetch fails", async () => {
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
    mockGetResume.mockResolvedValue(RESUME);
    mockListCommits.mockResolvedValue(COMMITS);
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
