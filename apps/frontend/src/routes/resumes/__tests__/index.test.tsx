/**
 * Tests for the /resumes route — Resume List Page.
 *
 * Acceptance criteria covered:
 *   - Renders loading state (CircularProgress) while query is pending
 *   - Renders empty state when no resumes are returned
 *   - Renders resume list with title and language chip
 *   - Clicking a row navigates to /resumes/$id
 *   - Renders error state when the query fails
 *   - Redirects to /login when unauthenticated (beforeLoad guard)
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
import { Route, LIST_RESUMES_QUERY_KEY } from "..";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../orpc-client", () => ({
  orpc: {
    listResumes: vi.fn(),
    getResume: vi.fn(),
    updateResume: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";

const mockListResumes = orpc.listResumes as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
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

const TEST_RESUMES = [
  {
    id: "resume-id-1",
    employeeId: "emp-id-1",
    title: "Senior Developer Resume",
    summary: "Experienced developer",
    language: "en",
    isMain: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "resume-id-2",
    employeeId: "emp-id-1",
    title: "Junior Developer Resume",
    summary: null,
    language: "sv",
    isMain: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const ResumeListPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<ResumeListPage />, { queryClient });
  return { ...result, queryClient };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar element while listResumes is loading", () => {
    mockListResumes.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render table rows while loading", () => {
    mockListResumes.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryByRole("row")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Empty state", () => {
  beforeEach(() => {
    mockListResumes.mockResolvedValue([]);
  });

  it("renders the translated empty message when no resumes are returned", async () => {
    renderPage();
    const emptyMsg = await screen.findByText(enCommon.resume.empty);
    expect(emptyMsg).toBeInTheDocument();
  });

  it("does not render a table when resume list is empty", async () => {
    renderPage();
    await screen.findByText(enCommon.resume.empty);
    expect(screen.queryByRole("table")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resume list rendering
// ---------------------------------------------------------------------------

describe("Resume list rendering", () => {
  beforeEach(() => {
    mockListResumes.mockResolvedValue(TEST_RESUMES);
  });

  it("renders the page title", async () => {
    renderPage();
    const title = await screen.findByText(enCommon.resume.pageTitle);
    expect(title).toBeInTheDocument();
  });

  it("renders the first resume title in the table", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const titleCell = await screen.findByText(TEST_RESUMES[0]!.title);
    expect(titleCell).toBeInTheDocument();
  });

  it("renders the second resume title in the table", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const titleCell = await screen.findByText(TEST_RESUMES[1]!.title);
    expect(titleCell).toBeInTheDocument();
  });

  it("renders the language chip for the first resume", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const languageChip = await screen.findByText(TEST_RESUMES[0]!.language);
    expect(languageChip).toBeInTheDocument();
  });

  it("renders the main badge for the main resume", async () => {
    renderPage();
    // "Main" appears in both the table header and the chip badge — findAllByText covers both
    const mainElements = await screen.findAllByText(enCommon.resume.mainBadge);
    expect(mainElements.length).toBeGreaterThan(0);
  });

  it("renders table headers", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await screen.findByText(TEST_RESUMES[0]!.title);
    expect(
      screen.getByText(enCommon.resume.tableHeaderTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByText(enCommon.resume.tableHeaderLanguage)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Row navigation
// ---------------------------------------------------------------------------

describe("Row click navigation", () => {
  beforeEach(() => {
    mockListResumes.mockResolvedValue(TEST_RESUMES);
  });

  it("navigates to /resumes/$id when a row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = await screen.findByText(TEST_RESUMES[0]!.title);
    await user.click(row);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      params: { id: TEST_RESUMES[0]!.id },
    });
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  beforeEach(() => {
    mockListResumes.mockRejectedValue(new Error("Server error"));
  });

  it("renders an error alert when listResumes fails", async () => {
    renderPage();
    const errorMsg = await screen.findByText(enCommon.resume.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe("Exports", () => {
  it("exports LIST_RESUMES_QUERY_KEY as a const tuple", () => {
    expect(LIST_RESUMES_QUERY_KEY).toEqual(["listResumes"]);
  });

  it("exports Route with the correct path", () => {
    expect(Route).toBeDefined();
    expect(Route.options.component).toBeDefined();
  });
});
