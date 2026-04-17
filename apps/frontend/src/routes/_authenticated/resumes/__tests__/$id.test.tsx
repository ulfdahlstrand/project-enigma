/**
 * Tests for the /resumes/$id route — Resume Detail Page (read-only).
 *
 * Acceptance criteria covered:
 *   - Renders loading state (CircularProgress) while query is pending
 *   - Renders resume title, language chip, and summary when data resolves
 *   - Renders skills list when resume has skills
 *   - Renders "no skills" message when skills array is empty
 *   - Renders not-found message when query returns NOT_FOUND error
 *   - Edit button is present and links to /resumes/$id/edit
 *   - Back link is present and points to /resumes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../locales/en/common.json";
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../../test-utils/render";
import { getResumeLanguageTranslations } from "../../../../components/resume-detail/resume-language-translations";
import { Route, ResumeDetailPage, getResumeQueryKey } from "../$id";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../../components/RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown; params?: unknown },
    ref: React.Ref<HTMLAnchorElement>
  ) {
    return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
  }),
}));

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listResumes: vi.fn(),
    getResume: vi.fn(),
    getResumeBranch: vi.fn(),
    deleteResume: vi.fn(),
    updateResume: vi.fn(),
    listBranchAssignmentsFull: vi.fn(),
    listResumeBranches: vi.fn(),
    getResumeCommit: vi.fn(),
    getEmployee: vi.fn(),
    listEducation: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockGetResume = orpc.getResume as ReturnType<typeof vi.fn>;
const mockGetResumeBranch = orpc.getResumeBranch as ReturnType<typeof vi.fn>;
const mockDeleteResume = orpc.deleteResume as ReturnType<typeof vi.fn>;
const mockListBranchAssignmentsFull = orpc.listBranchAssignmentsFull as ReturnType<typeof vi.fn>;
const mockListResumeBranches = orpc.listResumeBranches as ReturnType<typeof vi.fn>;
const mockGetEmployee = orpc.getEmployee as ReturnType<typeof vi.fn>;
const mockListEducation = orpc.listEducation as ReturnType<typeof vi.fn>;
const mockGetResumeCommit = orpc.getResumeCommit as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const TEST_RESUME_ID = "resume-test-id-99";
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_RESUME_ID }),
    useSearch: () => ({}),
    useNavigate: () => mockNavigate,
    useRouterState: () => ({ location: { pathname: `/resumes/${TEST_RESUME_ID}` } }),
    Outlet: () => null,
    Link: React.forwardRef(function MockLink(
      {
        children,
        to,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return (
        <a href={to} ref={ref} {...props}>
          {children}
        </a>
      );
    }),
  };
});

vi.mock("../../../../components/RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    {
      to,
      params,
      children,
      ...props
    }: { to?: string; params?: Record<string, string>; children?: React.ReactNode; [key: string]: unknown },
    ref: React.Ref<HTMLAnchorElement>
  ) {
    let href = String(to ?? "");
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        href = href.replace(`$${k}`, String(v));
      }
    }
    return <a href={href} ref={ref} {...props}>{children}</a>;
  }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_RESUME = {
  id: TEST_RESUME_ID,
  employeeId: "emp-id-1",
  title: "Senior Developer Resume",
  summary: "Experienced full-stack developer with 10 years of experience.",
  language: "en",
  isMain: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  skillGroups: [
    { id: "group-1", resumeId: TEST_RESUME_ID, name: "Programming", sortOrder: 0 },
    { id: "group-2", resumeId: TEST_RESUME_ID, name: "Frontend", sortOrder: 1 },
  ],
  skills: [
    { id: "skill-1", resumeId: TEST_RESUME_ID, groupId: "group-1", name: "TypeScript", category: "Programming", sortOrder: 0 },
    { id: "skill-2", resumeId: TEST_RESUME_ID, groupId: "group-2", name: "React", category: "Frontend", sortOrder: 0 },
  ],
};

const TEST_RESUME_NO_SKILLS = {
  ...TEST_RESUME,
  skills: [],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<ResumeDetailPage routeMode="detail" />, { queryClient });
  return { ...result, queryClient };
}

const TEST_EMPLOYEE = { id: "emp-id-1", name: "Jane Doe", email: "jane@example.com" };

const MAIN_BRANCH = {
  id: "branch-main-1",
  resumeId: TEST_RESUME_ID,
  name: "main",
  isMain: true,
  headCommitId: "commit-1",
  createdAt: "2024-01-01T00:00:00Z",
};

const SWEDISH_BRANCH = {
  id: "branch-sv-1",
  resumeId: TEST_RESUME_ID,
  name: "Swedish",
  isMain: false,
  headCommitId: "commit-2",
  createdAt: "2024-02-01T00:00:00Z",
};

beforeEach(() => {
  mockListBranchAssignmentsFull.mockResolvedValue([]);
  mockListResumeBranches.mockResolvedValue([MAIN_BRANCH]);
  mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
  mockListEducation.mockResolvedValue([]);
  mockGetResumeCommit.mockResolvedValue({ id: "commit-1", content: {} });
  mockGetResumeBranch.mockResolvedValue({
    ...TEST_RESUME,
    branchId: SWEDISH_BRANCH.id,
    branchName: SWEDISH_BRANCH.name,
    isMainBranch: false,
    headCommitId: SWEDISH_BRANCH.headCommitId,
    forkedFromCommitId: null,
  });
  mockDeleteResume.mockResolvedValue({ deleted: true });
  mockNavigate.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar element while getResume is loading", () => {
    mockGetResume.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render the resume title while loading", () => {
    mockGetResume.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryByText(TEST_RESUME.title)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resolved data rendering
// ---------------------------------------------------------------------------

describe("Resume detail rendering", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("renders the resume title as a heading", async () => {
    renderPage();
    // Title appears in both PageHeader and DocumentPage header — use findAllByText
    const titles = await screen.findAllByText(TEST_RESUME.title);
    expect(titles.length).toBeGreaterThan(0);
  });

  it("renders the language chip", async () => {
    renderPage();
    // Language chip appears in both PageHeader and DocumentPage header
    const chips = await screen.findAllByText(TEST_RESUME.language.toUpperCase());
    expect(chips.length).toBeGreaterThan(0);
  });

  it("shows the resume language when viewing a branch", async () => {
    mockListResumeBranches.mockResolvedValue([MAIN_BRANCH, SWEDISH_BRANCH]);
    mockGetResumeBranch.mockResolvedValue({
      ...TEST_RESUME,
      language: "sv",
      branchId: SWEDISH_BRANCH.id,
      branchName: SWEDISH_BRANCH.name,
      isMainBranch: false,
      headCommitId: SWEDISH_BRANCH.headCommitId,
      forkedFromCommitId: null,
    });

    const queryClient = buildTestQueryClient();
    renderWithProviders(<ResumeDetailPage forcedBranchId={SWEDISH_BRANCH.id} />, { queryClient });

    const chips = await screen.findAllByText("SV");
    expect(chips.length).toBeGreaterThan(0);
  });

  it("renders document headings in the active branch language instead of the UI language", async () => {
    mockListResumeBranches.mockResolvedValue([MAIN_BRANCH, SWEDISH_BRANCH]);
    mockGetResumeBranch.mockResolvedValue({
      ...TEST_RESUME,
      language: "sv",
      presentation: ["Kort svensk presentation."],
      branchId: SWEDISH_BRANCH.id,
      branchName: SWEDISH_BRANCH.name,
      isMainBranch: false,
      headCommitId: SWEDISH_BRANCH.headCommitId,
      forkedFromCommitId: null,
    });

    const queryClient = buildTestQueryClient();
    renderWithProviders(<ResumeDetailPage forcedBranchId={SWEDISH_BRANCH.id} />, { queryClient });

    expect(await screen.findByText("Konsultprofil")).toBeInTheDocument();
    expect(screen.queryByText(enCommon.resume.detail.consultantProfileLabel)).toBeNull();
  });

  it("renders the summary text", async () => {
    renderPage();
    const summary = await screen.findByText(TEST_RESUME.summary!);
    expect(summary).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Skills list
// ---------------------------------------------------------------------------

describe("Skills list", () => {
  it("renders the consultant profile label on the skills page", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    const label = await screen.findByText(getResumeLanguageTranslations(TEST_RESUME.language).consultantProfile);
    expect(label).toBeInTheDocument();
  });

  it("renders each skill name", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    // Wait for skills page to render, then query synchronously to avoid stale refs
    await screen.findByText(getResumeLanguageTranslations(TEST_RESUME.language).consultantProfile);
    for (const skill of TEST_RESUME.skills) {
      expect(screen.getByText(skill.name)).toBeInTheDocument();
    }
  });

  it("renders skill categories as uppercase labels", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    // Categories are rendered toUpperCase in CategoryBlock
    const programmingLabel = await screen.findByText("PROGRAMMING");
    expect(programmingLabel).toBeInTheDocument();
    expect(screen.getByText("FRONTEND")).toBeInTheDocument();
  });

  it("does not render the skills page when skills array is empty", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME_NO_SKILLS);
    renderPage();
    // Wait for resume to load, then verify skills page is absent
    await screen.findAllByText(TEST_RESUME.title);
    expect(screen.queryByText(enCommon.resume.detail.consultantProfileLabel)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

describe("Navigation", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("renders a breadcrumb link to /resumes", async () => {
    renderPage();
    await screen.findAllByText(TEST_RESUME.title);
    const resumesLink = screen.getByRole("link", { name: enCommon.resume.pageTitle });
    expect(resumesLink).toBeInTheDocument();
  });

it("opens a delete dialog and deletes the resume", async () => {
    const user = userEvent.setup();
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();

    await screen.findAllByText(TEST_RESUME.title);
    await user.click(screen.getByRole("button", { name: enCommon.resume.detail.moreActionsLabel }));
    await user.click(screen.getByRole("menuitem", { name: enCommon.resume.detail.deleteButton }));

    expect(screen.getByText(enCommon.resume.detail.deleteDialog.title)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: enCommon.resume.detail.deleteDialog.confirm }));

    expect(mockDeleteResume).toHaveBeenCalledWith({ id: TEST_RESUME_ID });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes",
      search: { employeeId: TEST_RESUME.employeeId },
    });
  });

});

describe("Commit-first branch resolution", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("resolves a branch route to the branch head commit before calling getResume", async () => {
    const queryClient = buildTestQueryClient();
    renderWithProviders(<ResumeDetailPage routeMode="detail" forcedBranchId={MAIN_BRANCH.id} />, { queryClient });

    await screen.findAllByText(TEST_RESUME.title);

    await waitFor(() =>
      expect(mockGetResume).toHaveBeenCalledWith({
        id: TEST_RESUME_ID,
        commitId: MAIN_BRANCH.headCommitId,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Not-found error state
// ---------------------------------------------------------------------------

describe("NOT_FOUND error state", () => {
  beforeEach(() => {
    const notFoundError = Object.assign(new Error("Not found"), {
      code: "NOT_FOUND",
    });
    mockGetResume.mockRejectedValue(notFoundError);
  });

  it("renders the not-found message", async () => {
    renderPage();
    const notFoundMsg = await screen.findByText(enCommon.resume.detail.notFound);
    expect(notFoundMsg).toBeInTheDocument();
  });

  it("does not render any input elements when resume is not found", async () => {
    renderPage();
    await screen.findByText(enCommon.resume.detail.notFound);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Generic error state
// ---------------------------------------------------------------------------

describe("Generic error state", () => {
  beforeEach(() => {
    mockGetResume.mockRejectedValue(new Error("Server error"));
  });

  it("renders an error alert when getResume fails", async () => {
    renderPage();
    const errorMsg = await screen.findByText(enCommon.resume.detail.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

describe("getResumeQueryKey", () => {
  it("returns a tuple with 'getResume', the id, the branch id, and the commit id", () => {
    const key = getResumeQueryKey("my-resume-id", "my-branch-id");
    expect(key).toEqual(["getResume", "my-resume-id", "my-branch-id", null]);
  });

  it("uses null when no branch id or commit id is provided", () => {
    const key = getResumeQueryKey("my-resume-id");
    expect(key).toEqual(["getResume", "my-resume-id", null, null]);
  });

  it("includes commit id when provided", () => {
    const key = getResumeQueryKey("my-resume-id", "my-branch-id", "my-commit-id");
    expect(key).toEqual(["getResume", "my-resume-id", "my-branch-id", "my-commit-id"]);
  });
});

// ---------------------------------------------------------------------------
// Route export
// ---------------------------------------------------------------------------

describe("Route export", () => {
  it("exports a Route object with a component", () => {
    expect(Route).toBeDefined();
    expect(Route.options.component).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Assignments section
// ---------------------------------------------------------------------------

const TEST_ASSIGNMENTS = [
  {
    id: "assign-1",
    employeeId: "emp-id-1",
    resumeId: TEST_RESUME_ID,
    clientName: "Acme Corp",
    role: "Senior Developer",
    description: "",
    startDate: "2022-01-01",
    endDate: "2023-06-30",
    technologies: ["TypeScript"],
    isCurrent: false,
    createdAt: "2022-01-01T00:00:00Z",
    updatedAt: "2022-01-01T00:00:00Z",
  },
  {
    id: "assign-2",
    employeeId: "emp-id-1",
    resumeId: TEST_RESUME_ID,
    clientName: "Beta Inc",
    role: "Tech Lead",
    description: "",
    startDate: "2023-07-01",
    endDate: null,
    technologies: ["Go"],
    isCurrent: true,
    createdAt: "2023-07-01T00:00:00Z",
    updatedAt: "2023-07-01T00:00:00Z",
  },
];

describe("Assignments section", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("renders the assignments heading when assignments exist", async () => {
    mockListBranchAssignmentsFull.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    const heading = await screen.findByText(getResumeLanguageTranslations(TEST_RESUME.language).experienceHeading);
    expect(heading).toBeInTheDocument();
  });

  it("does not render the assignments page when list is empty", async () => {
    mockListBranchAssignmentsFull.mockResolvedValue([]);
    renderPage();
    await screen.findAllByText(TEST_RESUME.title);
    expect(screen.queryByText(getResumeLanguageTranslations(TEST_RESUME.language).experienceHeading)).toBeNull();
  });

  it("renders role heading for each assignment", async () => {
    mockListBranchAssignmentsFull.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    // Role is rendered as a heading in the full card view
    await screen.findByText("Senior Developer");
    expect(screen.getByText("Tech Lead")).toBeInTheDocument();
  });

  it("renders client name in the subtitle for each assignment", async () => {
    mockListBranchAssignmentsFull.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    await screen.findByText("Senior Developer");
    // Client name appears as part of subtitle text node
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Beta Inc/).length).toBeGreaterThan(0);
  });

  it("renders 'Present' in the subtitle for current assignment", async () => {
    mockListBranchAssignmentsFull.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    await screen.findByText("Tech Lead");
    expect(screen.getByText(new RegExp(enCommon.resume.detail.assignmentPresent))).toBeInTheDocument();
  });
});
