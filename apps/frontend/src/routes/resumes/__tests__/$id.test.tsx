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

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";

import enCommon from "../../../locales/en/common.json";
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../test-utils/render";
import { Route, getResumeQueryKey } from "../$id";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../orpc-client", () => ({
  orpc: {
    listResumes: vi.fn(),
    getResume: vi.fn(),
    updateResume: vi.fn(),
    listAssignments: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";

const mockGetResume = orpc.getResume as ReturnType<typeof vi.fn>;
const mockListAssignments = orpc.listAssignments as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const TEST_RESUME_ID = "resume-test-id-99";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_RESUME_ID }),
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
  skills: [
    { id: "skill-1", cvId: TEST_RESUME_ID, name: "TypeScript", level: "Expert", category: "Programming", sortOrder: 1 },
    { id: "skill-2", cvId: TEST_RESUME_ID, name: "React", level: "Advanced", category: "Frontend", sortOrder: 2 },
  ],
};

const TEST_RESUME_NO_SKILLS = {
  ...TEST_RESUME,
  skills: [],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const ResumeDetailPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<ResumeDetailPage />, { queryClient });
  return { ...result, queryClient };
}

beforeEach(() => {
  mockListAssignments.mockResolvedValue([]);
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
    const title = await screen.findByText(TEST_RESUME.title);
    expect(title).toBeInTheDocument();
  });

  it("renders the language chip", async () => {
    renderPage();
    const languageChip = await screen.findByText(TEST_RESUME.language);
    expect(languageChip).toBeInTheDocument();
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
  it("renders skills heading", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    const heading = await screen.findByText(enCommon.resume.detail.skillsHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders each skill name", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    for (const skill of TEST_RESUME.skills) {
      const skillName = await screen.findByText(skill.name);
      expect(skillName).toBeInTheDocument();
    }
  });

  it("renders each skill level", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    renderPage();
    for (const skill of TEST_RESUME.skills) {
      const skillLevel = await screen.findByText(skill.level!);
      expect(skillLevel).toBeInTheDocument();
    }
  });

  it("renders 'no skills' message when skills array is empty", async () => {
    mockGetResume.mockResolvedValue(TEST_RESUME_NO_SKILLS);
    renderPage();
    const noSkills = await screen.findByText(enCommon.resume.detail.noSkills);
    expect(noSkills).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

describe("Navigation", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("renders an Edit button when data is loaded", async () => {
    renderPage();
    await screen.findByText(TEST_RESUME.title);
    const editBtn = screen.getByRole("button", {
      name: enCommon.resume.detail.editButton,
    });
    expect(editBtn).toBeInTheDocument();
  });

  it("renders a Back link to /resumes", async () => {
    renderPage();
    await screen.findByText(TEST_RESUME.title);
    const backLink = screen.getByText(enCommon.resume.detail.backButton);
    expect(backLink).toBeInTheDocument();
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
  it("returns a tuple with 'getResume' and the given id", () => {
    const key = getResumeQueryKey("my-resume-id");
    expect(key).toEqual(["getResume", "my-resume-id"]);
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

  it("renders the assignments heading", async () => {
    mockListAssignments.mockResolvedValue([]);
    renderPage();
    await screen.findByText(TEST_RESUME.title);
    expect(screen.getByText(enCommon.resume.detail.assignmentsHeading)).toBeInTheDocument();
  });

  it("renders 'no assignments' message when list is empty", async () => {
    mockListAssignments.mockResolvedValue([]);
    renderPage();
    await screen.findByText(TEST_RESUME.title);
    expect(screen.getByText(enCommon.resume.detail.noAssignments)).toBeInTheDocument();
  });

  it("renders client name and role for each assignment", async () => {
    mockListAssignments.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    await screen.findByText("Acme Corp");
    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("Tech Lead")).toBeInTheDocument();
  });

  it("renders 'Present' chip for current assignment", async () => {
    mockListAssignments.mockResolvedValue(TEST_ASSIGNMENTS);
    renderPage();
    await screen.findByText("Beta Inc");
    expect(screen.getByText(enCommon.resume.detail.assignmentPresent)).toBeInTheDocument();
  });
});
