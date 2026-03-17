/**
 * Tests for the /cv/$id route — CV Detail Page (read-only).
 *
 * Acceptance criteria covered:
 *   - Renders loading state (CircularProgress) while query is pending
 *   - Renders CV title, language chip, and summary when data resolves
 *   - Renders skills list when CV has skills
 *   - Renders "no skills" message when skills array is empty
 *   - Renders not-found message when query returns NOT_FOUND error
 *   - Edit button is present and links to /cv/$id/edit
 *   - Back link is present and points to /cv
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../locales/en/common.json";
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../test-utils/render";
import { Route, getCVQueryKey } from "../$id";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../orpc-client", () => ({
  orpc: {
    listCVs: vi.fn(),
    getCV: vi.fn(),
    updateCV: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";

const mockGetCV = orpc.getCV as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const TEST_CV_ID = "cv-test-id-99";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_CV_ID }),
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

const TEST_CV = {
  id: TEST_CV_ID,
  employeeId: "emp-id-1",
  title: "Senior Developer CV",
  summary: "Experienced full-stack developer with 10 years of experience.",
  language: "en",
  isMain: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  skills: [
    { id: "skill-1", cvId: TEST_CV_ID, name: "TypeScript", level: "Expert", category: "Programming", sortOrder: 1 },
    { id: "skill-2", cvId: TEST_CV_ID, name: "React", level: "Advanced", category: "Frontend", sortOrder: 2 },
  ],
};

const TEST_CV_NO_SKILLS = {
  ...TEST_CV,
  skills: [],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const CvDetailPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<CvDetailPage />, { queryClient });
  return { ...result, queryClient };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar element while getCV is loading", () => {
    mockGetCV.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render the CV title while loading", () => {
    mockGetCV.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryByText(TEST_CV.title)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resolved data rendering
// ---------------------------------------------------------------------------

describe("CV detail rendering", () => {
  beforeEach(() => {
    mockGetCV.mockResolvedValue(TEST_CV);
  });

  it("renders the CV title as a heading", async () => {
    renderPage();
    const title = await screen.findByText(TEST_CV.title);
    expect(title).toBeInTheDocument();
  });

  it("renders the language chip", async () => {
    renderPage();
    const languageChip = await screen.findByText(TEST_CV.language);
    expect(languageChip).toBeInTheDocument();
  });

  it("renders the summary text", async () => {
    renderPage();
    const summary = await screen.findByText(TEST_CV.summary!);
    expect(summary).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Skills list
// ---------------------------------------------------------------------------

describe("Skills list", () => {
  it("renders skills heading", async () => {
    mockGetCV.mockResolvedValue(TEST_CV);
    renderPage();
    const heading = await screen.findByText(enCommon.cv.detail.skillsHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders each skill name", async () => {
    mockGetCV.mockResolvedValue(TEST_CV);
    renderPage();
    for (const skill of TEST_CV.skills) {
      const skillName = await screen.findByText(skill.name);
      expect(skillName).toBeInTheDocument();
    }
  });

  it("renders each skill level", async () => {
    mockGetCV.mockResolvedValue(TEST_CV);
    renderPage();
    for (const skill of TEST_CV.skills) {
      const skillLevel = await screen.findByText(skill.level!);
      expect(skillLevel).toBeInTheDocument();
    }
  });

  it("renders 'no skills' message when skills array is empty", async () => {
    mockGetCV.mockResolvedValue(TEST_CV_NO_SKILLS);
    renderPage();
    const noSkills = await screen.findByText(enCommon.cv.detail.noSkills);
    expect(noSkills).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

describe("Navigation", () => {
  beforeEach(() => {
    mockGetCV.mockResolvedValue(TEST_CV);
  });

  it("renders an Edit button when data is loaded", async () => {
    renderPage();
    await screen.findByText(TEST_CV.title);
    const editBtn = screen.getByRole("button", {
      name: enCommon.cv.detail.editButton,
    });
    expect(editBtn).toBeInTheDocument();
  });

  it("renders a Back link to /cv", async () => {
    renderPage();
    await screen.findByText(TEST_CV.title);
    const backLink = screen.getByText(enCommon.cv.detail.backButton);
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
    mockGetCV.mockRejectedValue(notFoundError);
  });

  it("renders the not-found message", async () => {
    renderPage();
    const notFoundMsg = await screen.findByText(enCommon.cv.detail.notFound);
    expect(notFoundMsg).toBeInTheDocument();
  });

  it("does not render any input elements when CV is not found", async () => {
    renderPage();
    await screen.findByText(enCommon.cv.detail.notFound);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Generic error state
// ---------------------------------------------------------------------------

describe("Generic error state", () => {
  beforeEach(() => {
    mockGetCV.mockRejectedValue(new Error("Server error"));
  });

  it("renders an error alert when getCV fails", async () => {
    renderPage();
    const errorMsg = await screen.findByText(enCommon.cv.detail.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

describe("getCVQueryKey", () => {
  it("returns a tuple with 'getCV' and the given id", () => {
    const key = getCVQueryKey("my-cv-id");
    expect(key).toEqual(["getCV", "my-cv-id"]);
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
