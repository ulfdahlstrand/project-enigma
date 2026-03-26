/**
 * Tests for /resumes/$id/variants — Variants page.
 *
 * Acceptance criteria:
 *   - Loading spinner while query is pending
 *   - Error state when branches fetch fails
 *   - Renders branch list with name, language, main badge
 *   - "Create variant" button opens dialog
 *   - Dialog calls forkResumeBranch on confirm
 *   - Back button navigates to /resumes/$id
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../../test-utils/render";
import { Route } from "../variants/index";

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockForkMutateAsync = vi.fn();

vi.mock("../../../../../hooks/versioning", () => ({
  useResumeBranches: vi.fn(),
  useResumeCommits: vi.fn(),
  useForkResumeBranch: () => ({
    mutateAsync: mockForkMutateAsync,
    isPending: false,
  }),
}));

import { useResumeBranches, useResumeCommits } from "../../../../../hooks/versioning";
const mockUseResumeBranches = useResumeBranches as ReturnType<typeof vi.fn>;
const mockUseResumeCommits = useResumeCommits as ReturnType<typeof vi.fn>;

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

const BRANCHES = [
  {
    id: "branch-id-1",
    resumeId: "resume-id-1",
    name: "main",
    isMain: true,
    language: "en",
    headCommitId: "commit-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "branch-id-2",
    resumeId: "resume-id-1",
    name: "Swedish variant",
    isMain: false,
    language: "sv",
    headCommitId: "commit-2",
    createdAt: "2024-02-01T00:00:00Z",
  },
];

const COMMITS = [
  {
    id: "commit-3",
    resumeId: "resume-id-1",
    branchId: "branch-id-1",
    parentCommitId: null,
    message: "Initial version",
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    id: "commit-4",
    resumeId: "resume-id-1",
    branchId: "branch-id-1",
    parentCommitId: "commit-3",
    message: "Updated skills",
    createdAt: "2024-04-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const VariantsPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return { ...renderWithProviders(<VariantsPage />, { queryClient }), queryClient };
}

beforeEach(() => {
  // Safe defaults — each describe can override as needed
  mockUseResumeCommits.mockReturnValue({ data: undefined });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar while branches are loading", () => {
    mockUseResumeBranches.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("renders an error alert when branches fetch fails", async () => {
    mockUseResumeBranches.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();
    const errorMsg = await screen.findByText(enCommon.resume.variants.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Branch list
// ---------------------------------------------------------------------------

describe("Branch list", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false, isError: false });
    mockUseResumeCommits.mockReturnValue({ data: COMMITS });
  });

  it("renders the page title", async () => {
    renderPage();
    const title = await screen.findByRole("heading", { level: 1, name: enCommon.resume.variants.pageTitle });
    expect(title).toBeInTheDocument();
  });

  it("renders the main branch name", async () => {
    renderPage();
    const name = await screen.findByText("main");
    expect(name).toBeInTheDocument();
  });

  it("renders the secondary branch name", async () => {
    renderPage();
    const name = await screen.findByText("Swedish variant");
    expect(name).toBeInTheDocument();
  });

  it("renders the main badge for the main branch", async () => {
    renderPage();
    const badge = await screen.findByText(enCommon.resume.variants.mainBadge);
    expect(badge).toBeInTheDocument();
  });

  it("renders language chips", async () => {
    renderPage();
    const enChip = await screen.findByText("en");
    expect(enChip).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    renderPage();
    await screen.findByText("main");
    expect(screen.getByText(enCommon.resume.variants.tableHeaderName)).toBeInTheDocument();
    expect(screen.getByText(enCommon.resume.variants.tableHeaderLanguage)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Empty state", () => {
  it("renders the empty message when no branches exist", async () => {
    mockUseResumeBranches.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderPage();
    const msg = await screen.findByText(enCommon.resume.variants.empty);
    expect(msg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Create variant dialog
// ---------------------------------------------------------------------------

describe("Create variant dialog", () => {
  beforeEach(() => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false, isError: false });
    mockUseResumeCommits.mockReturnValue({ data: COMMITS });
  });

  it("opens dialog when create button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const createBtn = await screen.findByText(enCommon.resume.variants.createButton);
    await user.click(createBtn);
    expect(screen.getByText(enCommon.resume.variants.createDialog.title)).toBeInTheDocument();
  });

  it("shows the commit selector in the dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    const createBtn = await screen.findByText(enCommon.resume.variants.createButton);
    await user.click(createBtn);
    // The "based on" label should appear (MUI renders it in label + legend span)
    const labels = screen.getAllByText(enCommon.resume.variants.createDialog.basedOnLabel);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("disables the Create button when no name is entered", async () => {
    const user = userEvent.setup();
    renderPage();
    const createBtn = await screen.findByText(enCommon.resume.variants.createButton);
    await user.click(createBtn);
    const confirmBtn = screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create });
    expect(confirmBtn).toBeDisabled();
  });

  it("disables the Create variant button when no commits exist", async () => {
    mockUseResumeCommits.mockReturnValue({ data: [] });
    renderPage();
    await screen.findByRole("heading", { level: 1, name: enCommon.resume.variants.pageTitle });
    const createBtn = screen.getByRole("button", { name: enCommon.resume.variants.createButton });
    expect(createBtn).toBeDisabled();
  });

  it("calls forkResumeBranch when create is confirmed with a name", async () => {
    mockForkMutateAsync.mockResolvedValue({ id: "branch-new" });
    const user = userEvent.setup();
    renderPage();

    const createBtn = await screen.findByText(enCommon.resume.variants.createButton);
    await user.click(createBtn);

    const nameInput = screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel);
    await user.type(nameInput, "New Variant");

    const confirmBtn = screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create });
    await user.click(confirmBtn);

    // openDialog() pre-selects commits[0].id (most recent)
    expect(mockForkMutateAsync).toHaveBeenCalledWith({
      fromCommitId: COMMITS[0]!.id,
      name: "New Variant",
      resumeId: "resume-id-1",
    });
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const createBtn = await screen.findByText(enCommon.resume.variants.createButton);
    await user.click(createBtn);

    const cancelBtn = screen.getByText(enCommon.resume.variants.createDialog.cancel);
    await user.click(cancelBtn);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Breadcrumb navigation", () => {
  it("renders a breadcrumb link back to the resumes list", async () => {
    mockUseResumeBranches.mockReturnValue({ data: BRANCHES, isLoading: false, isError: false });
    mockUseResumeCommits.mockReturnValue({ data: COMMITS });
    renderPage();

    await screen.findByRole("heading", { level: 1, name: enCommon.resume.variants.pageTitle });
    const resumesLink = screen.getByRole("link", { name: enCommon.resume.pageTitle });
    expect(resumesLink).toBeInTheDocument();
  });
});
