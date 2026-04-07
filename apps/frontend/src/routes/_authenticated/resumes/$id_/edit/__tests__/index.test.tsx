import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders, buildTestQueryClient } from "../../../../../../test-utils/render";
import enCommon from "../../../../../../locales/en/common.json";
import { Route } from "../index";

const TEST_RESUME_ID = "resume-test-id-99";
const mockNavigate = vi.fn();
const mockOpenInlineRevision = vi.fn();
const mockCloseInlineRevision = vi.fn();
let mockSearch: { branchId?: string; assistant?: "true"; sourceBranchId?: string } = {};

vi.mock("../../../../../../hooks/inline-resume-revision", () => ({
  useInlineResumeRevision: () => {
    const [isOpen, setIsOpen] = React.useState(false);
    return {
      isOpen,
      stage: "revision",
      workItems: null,
      suggestions: [],
      selectedSuggestionId: null,
      sourceBranchName: "main",
      checklistWidth: 320,
      chatWidth: 360,
      toolRegistry: { tools: [] },
      toolContext: { route: "resume", entityType: "resume", entityId: TEST_RESUME_ID },
      applyingSuggestionId: null,
      isPreparingFinalize: false,
      isReadyToFinalize: false,
      isOpening: false,
      isMerging: false,
      isKeeping: false,
      reviewDialog: { open: false },
      open: () => {
        mockOpenInlineRevision();
        setIsOpen(true);
      },
      close: () => {
        mockCloseInlineRevision();
        setIsOpen(false);
      },
      reset: vi.fn(),
      prepareFinalize: vi.fn(),
      backToRevision: vi.fn(),
      selectSuggestion: vi.fn(),
      openSuggestionReview: vi.fn(),
      keepBranch: vi.fn(),
      mergeBranch: vi.fn(),
    };
  },
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

vi.mock("../../../../../../components/revision/InlineRevisionChatPanel", () => ({
  InlineRevisionChatPanel: ({
    toolContext,
  }: {
    toolContext: { route?: string; entityType?: string; entityId?: string };
  }) => (
    <div data-testid="assistant-chat-panel">
      assistant:{toolContext.entityType}:{toolContext.entityId}:{toolContext.route}
    </div>
  ),
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
const mockGetResumeCommit = orpc.getResumeCommit as ReturnType<typeof vi.fn>;

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
  ],
  skills: [
    { id: "skill-1", resumeId: TEST_RESUME_ID, groupId: "group-1", name: "TypeScript", category: "Programming", sortOrder: 0 },
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
  mockCloseInlineRevision.mockReset();
  mockGetResume.mockResolvedValue(TEST_RESUME);
  mockListResumeBranches.mockResolvedValue([MAIN_BRANCH]);
  mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
  mockListBranchAssignmentsFull.mockResolvedValue([]);
  mockListEducation.mockResolvedValue([]);
  mockGetResumeCommit.mockResolvedValue({ id: "commit-2", content: { skills: [], skillGroups: [] } });
});

describe("/resumes/$id/edit", () => {
  it("renders edit mode without assistant panels by default", async () => {
    renderPage();

    await screen.findAllByText(TEST_RESUME.title);

    expect(screen.getByRole("button", { name: enCommon.revision.inline.aiHelpButton })).toBeInTheDocument();
    expect(screen.queryByText(enCommon.revision.inline.checklistTitle)).toBeNull();
    expect(screen.queryByTestId("assistant-chat-panel")).toBeNull();
    expect(mockOpenInlineRevision).not.toHaveBeenCalled();
  });

  it("opens assistant mode from the URL signal", async () => {
    mockSearch = { assistant: "true" };
    renderPage();

    await screen.findAllByText(TEST_RESUME.title);

    await waitFor(() => {
      expect(mockOpenInlineRevision).toHaveBeenCalled();
      expect(screen.getByTestId("assistant-chat-panel")).toHaveTextContent(
        `assistant:resume:${TEST_RESUME_ID}:resume`
      );
    });
  });

  it("does not call open() when sourceBranchId is in the URL (hook handles restoration)", async () => {
    mockSearch = { branchId: "branch-revision-1", assistant: "true", sourceBranchId: MAIN_BRANCH.id };
    mockListResumeBranches.mockResolvedValue([
      MAIN_BRANCH,
      {
        id: "branch-revision-1",
        resumeId: TEST_RESUME_ID,
        name: "revision/review-presentation",
        isMain: false,
        language: "en",
        headCommitId: "commit-2",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ]);

    renderPage();

    await screen.findAllByText(TEST_RESUME.title);

    // When sourceBranchId is present, $id.tsx defers restoration to the hook — open() should not be called
    await waitFor(() => {
      expect(mockOpenInlineRevision).not.toHaveBeenCalled();
    });
  });

  it("calls open and shows assistant when Assistant is clicked", async () => {
    renderPage();
    await screen.findAllByText(TEST_RESUME.title);

    fireEvent.click(screen.getByRole("button", { name: enCommon.revision.inline.aiHelpButton }));

    await waitFor(() => {
      expect(mockOpenInlineRevision).toHaveBeenCalled();
      expect(screen.getByTestId("assistant-chat-panel")).toBeInTheDocument();
    });
  });
});
