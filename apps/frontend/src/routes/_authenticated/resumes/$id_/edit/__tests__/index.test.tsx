import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, buildTestQueryClient } from "../../../../../../test-utils/render";
import enCommon from "../../../../../../locales/en/common.json";
import { Route } from "../index";

const TEST_RESUME_ID = "resume-test-id-99";
const mockNavigate = vi.fn();
const mockOpenInlineRevision = vi.fn();
let mockSearch: { branchId?: string; assistant?: "true" } = {};

vi.mock("../../../../../../hooks/inline-resume-revision", () => ({
  useInlineResumeRevision: () => ({
    isOpen: false,
    stage: "planning",
    plan: null,
    workItems: null,
    suggestions: [],
    selectedSuggestionId: null,
    sourceBranchName: "main",
    checklistWidth: 320,
    chatWidth: 360,
    planningToolRegistry: {},
    actionToolRegistry: {},
    planningToolContext: { route: "resume" },
    actionToolContext: { route: "resume" },
    guardrail: { isSatisfied: true, reminderMessage: "" },
    automation: null,
    applyingSuggestionId: null,
    isPreparingFinalize: false,
    isReadyToFinalize: false,
    isMovingToActions: false,
    isMerging: false,
    isKeeping: false,
    reviewDialog: { open: false },
    open: mockOpenInlineRevision,
    close: vi.fn(),
    reset: vi.fn(),
    openActions: vi.fn(),
    prepareFinalize: vi.fn(),
    backToActions: vi.fn(),
    selectSuggestion: vi.fn(),
    openSuggestionReview: vi.fn(),
    keepBranch: vi.fn(),
    mergeBranch: vi.fn(),
  }),
}));

vi.mock("../../../../../../components/RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown; params?: unknown },
    ref: React.Ref<HTMLAnchorElement>
  ) {
    return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
  }),
}));

vi.mock("../../../../../../components/resume-detail/ResumeRevisionReviewDialog", () => ({
  ResumeRevisionReviewDialog: () => null,
}));

vi.mock("../../../../../../orpc-client", () => ({
  orpc: {
    getResume: vi.fn(),
    listResumeBranches: vi.fn(),
    getEmployee: vi.fn(),
    listBranchAssignmentsFull: vi.fn(),
    listEducation: vi.fn(),
    updateResume: vi.fn(),
    deleteResume: vi.fn(),
    getResumeCommit: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_RESUME_ID }),
    useSearch: () => mockSearch,
    useNavigate: () => mockNavigate,
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

import { orpc } from "../../../../../../orpc-client";

const mockGetResume = orpc.getResume as ReturnType<typeof vi.fn>;
const mockListResumeBranches = orpc.listResumeBranches as ReturnType<typeof vi.fn>;
const mockGetEmployee = orpc.getEmployee as ReturnType<typeof vi.fn>;
const mockListBranchAssignmentsFull = orpc.listBranchAssignmentsFull as ReturnType<typeof vi.fn>;
const mockListEducation = orpc.listEducation as ReturnType<typeof vi.fn>;

const TEST_RESUME = {
  id: TEST_RESUME_ID,
  employeeId: "emp-id-1",
  title: "Senior Developer Resume",
  summary: "Experienced full-stack developer with 10 years of experience.",
  language: "en",
  isMain: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  skills: [
    { id: "skill-1", cvId: TEST_RESUME_ID, name: "TypeScript", level: "Expert", category: "Programming", sortOrder: 1 },
  ],
};

const MAIN_BRANCH = {
  id: "branch-main-1",
  resumeId: TEST_RESUME_ID,
  name: "main",
  isMain: true,
  language: "en",
  headCommitId: "commit-1",
  createdAt: "2024-01-01T00:00:00Z",
};

const TEST_EMPLOYEE = { id: "emp-id-1", name: "Jane Doe", email: "jane@example.com" };

const ResumeEditPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return renderWithProviders(<ResumeEditPage />, { queryClient });
}

beforeEach(() => {
  mockSearch = {};
  mockNavigate.mockReset();
  mockOpenInlineRevision.mockReset();
  mockGetResume.mockResolvedValue(TEST_RESUME);
  mockListResumeBranches.mockResolvedValue([MAIN_BRANCH]);
  mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
  mockListBranchAssignmentsFull.mockResolvedValue([]);
  mockListEducation.mockResolvedValue([]);
});

describe("/resumes/$id/edit", () => {
  it("renders edit mode without assistant panels by default", async () => {
    renderPage();

    await screen.findAllByText(TEST_RESUME.title);

    expect(screen.getByRole("button", { name: enCommon.revision.inline.aiHelpButton })).toBeInTheDocument();
    expect(screen.queryByText(enCommon.revision.inline.checklistTitle)).toBeNull();
    expect(screen.queryByText(enCommon.revision.inline.chatTitle)).toBeNull();
    expect(mockOpenInlineRevision).not.toHaveBeenCalled();
  });

  it("opens assistant mode from the URL signal", async () => {
    mockSearch = { assistant: "true" };
    renderPage();

    await screen.findAllByText(TEST_RESUME.title);

    expect(mockOpenInlineRevision).toHaveBeenCalled();
  });

  it("updates the URL and opens assistant when Assistant is clicked", async () => {
    renderPage();
    await screen.findAllByText(TEST_RESUME.title);

    fireEvent.click(screen.getByRole("button", { name: enCommon.revision.inline.aiHelpButton }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/edit",
      params: { id: TEST_RESUME_ID },
      search: { assistant: "true" },
    });
    expect(mockOpenInlineRevision).toHaveBeenCalled();
  });
});
