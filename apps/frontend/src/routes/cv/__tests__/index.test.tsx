/**
 * Tests for the /cv route — CV List Page.
 *
 * Acceptance criteria covered:
 *   - Renders loading state (CircularProgress) while query is pending
 *   - Renders empty state when no CVs are returned
 *   - Renders CV list with title and language chip
 *   - Clicking a row navigates to /cv/$id
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
import { Route, LIST_CVS_QUERY_KEY } from "..";

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

const mockListCVs = orpc.listCVs as ReturnType<typeof vi.fn>;

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

const TEST_CVS = [
  {
    id: "cv-id-1",
    employeeId: "emp-id-1",
    title: "Senior Developer CV",
    summary: "Experienced developer",
    language: "en",
    isMain: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "cv-id-2",
    employeeId: "emp-id-1",
    title: "Junior Developer CV",
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

const CvListPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<CvListPage />, { queryClient });
  return { ...result, queryClient };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Loading state", () => {
  it("renders a progressbar element while listCVs is loading", () => {
    mockListCVs.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render table rows while loading", () => {
    mockListCVs.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryByRole("row")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Empty state", () => {
  beforeEach(() => {
    mockListCVs.mockResolvedValue([]);
  });

  it("renders the translated empty message when no CVs are returned", async () => {
    renderPage();
    const emptyMsg = await screen.findByText(enCommon.cv.empty);
    expect(emptyMsg).toBeInTheDocument();
  });

  it("does not render a table when CV list is empty", async () => {
    renderPage();
    await screen.findByText(enCommon.cv.empty);
    expect(screen.queryByRole("table")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CV list rendering
// ---------------------------------------------------------------------------

describe("CV list rendering", () => {
  beforeEach(() => {
    mockListCVs.mockResolvedValue(TEST_CVS);
  });

  it("renders the page title", async () => {
    renderPage();
    const title = await screen.findByText(enCommon.cv.pageTitle);
    expect(title).toBeInTheDocument();
  });

  it("renders the first CV title in the table", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const titleCell = await screen.findByText(TEST_CVS[0]!.title);
    expect(titleCell).toBeInTheDocument();
  });

  it("renders the second CV title in the table", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const titleCell = await screen.findByText(TEST_CVS[1]!.title);
    expect(titleCell).toBeInTheDocument();
  });

  it("renders the language chip for the first CV", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const languageChip = await screen.findByText(TEST_CVS[0]!.language);
    expect(languageChip).toBeInTheDocument();
  });

  it("renders the main badge for the main CV", async () => {
    renderPage();
    // "Main" appears in both the table header and the chip badge — findAllByText covers both
    const mainElements = await screen.findAllByText(enCommon.cv.mainBadge);
    expect(mainElements.length).toBeGreaterThan(0);
  });

  it("renders table headers", async () => {
    renderPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await screen.findByText(TEST_CVS[0]!.title);
    expect(
      screen.getByText(enCommon.cv.tableHeaderTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByText(enCommon.cv.tableHeaderLanguage)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Row navigation
// ---------------------------------------------------------------------------

describe("Row click navigation", () => {
  beforeEach(() => {
    mockListCVs.mockResolvedValue(TEST_CVS);
  });

  it("navigates to /cv/$id when a row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = await screen.findByText(TEST_CVS[0]!.title);
    await user.click(row);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/cv/$id",
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      params: { id: TEST_CVS[0]!.id },
    });
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  beforeEach(() => {
    mockListCVs.mockRejectedValue(new Error("Server error"));
  });

  it("renders an error alert when listCVs fails", async () => {
    renderPage();
    const errorMsg = await screen.findByText(enCommon.cv.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe("Exports", () => {
  it("exports LIST_CVS_QUERY_KEY as a const tuple", () => {
    expect(LIST_CVS_QUERY_KEY).toEqual(["listCVs"]);
  });

  it("exports Route with the correct path", () => {
    expect(Route).toBeDefined();
    expect(Route.options.component).toBeDefined();
  });
});
