/**
 * Tests for the /resumes/$id/edit route — Resume Editor Form.
 *
 * Acceptance criteria covered:
 *   - Renders summary textarea with the current resume value
 *   - Save button calls updateResume with the correct id and summary
 *   - Shows success alert after a successful save
 *   - Shows error alert on save failure
 *   - Shows loading state while resume is being fetched
 *   - Back button is present
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../locales/en/common.json";
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../../test-utils/render";
import { Route } from "../$id_.edit";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listResumes: vi.fn(),
    getResume: vi.fn(),
    updateResume: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockGetResume = orpc.getResume as ReturnType<typeof vi.fn>;
const mockUpdateResume = orpc.updateResume as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const TEST_RESUME_ID = "resume-edit-test-id";
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_RESUME_ID }),
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

const TEST_RESUME = {
  id: TEST_RESUME_ID,
  employeeId: "emp-id-1",
  title: "Senior Developer Resume",
  summary: "Initial summary text here.",
  language: "en",
  isMain: true,
  consultantTitle: null,
  presentation: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  skills: [
    { id: "skill-1", cvId: TEST_RESUME_ID, name: "TypeScript", level: "Expert", category: "Programming", sortOrder: 1 },
  ],
};

const UPDATED_RESUME = {
  ...TEST_RESUME,
  summary: "Updated summary text.",
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const ResumeEditPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<ResumeEditPage />, { queryClient });
  return { ...result, queryClient };
}

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
});

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe("Form rendering", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
  });

  it("renders the page title", async () => {
    renderPage();
    const pageTitle = await screen.findByRole("heading", { level: 1, name: enCommon.resume.edit.pageTitle });
    expect(pageTitle).toBeInTheDocument();
  });

  it("renders the summary textarea with current resume summary value", async () => {
    renderPage();
    const summaryInput = await screen.findByDisplayValue(TEST_RESUME.summary!);
    expect(summaryInput).toBeInTheDocument();
  });

  it("renders a Save button", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_RESUME.summary!);
    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    expect(saveBtn).toBeInTheDocument();
  });

  it("renders a breadcrumb link to /resumes", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_RESUME.summary!);
    const resumesLink = screen.getByRole("link", { name: enCommon.resume.pageTitle });
    expect(resumesLink).toBeInTheDocument();
    expect(resumesLink).toHaveAttribute("href", "/resumes");
  });
});

// ---------------------------------------------------------------------------
// Save — success
// ---------------------------------------------------------------------------

describe("Save — success", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    mockUpdateResume.mockResolvedValue(UPDATED_RESUME);
  });

  it("calls orpc.updateResume with the correct id and current summary on save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_RESUME.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateResume).toHaveBeenCalledWith(
        expect.objectContaining({
          id: TEST_RESUME_ID,
          summary: TEST_RESUME.summary,
        })
      );
    });
  });

  it("calls orpc.updateResume with updated summary after editing the field", async () => {
    const user = userEvent.setup();
    renderPage();

    const summaryInput = await screen.findByDisplayValue(TEST_RESUME.summary!);
    await user.clear(summaryInput);
    await user.type(summaryInput, "New summary content");

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateResume).toHaveBeenCalledWith(
        expect.objectContaining({
          id: TEST_RESUME_ID,
          summary: "New summary content",
        })
      );
    });
  });

  it("shows success alert after a successful save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_RESUME.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    const successMsg = await screen.findByText(enCommon.resume.edit.saveSuccess);
    expect(successMsg).toBeInTheDocument();
  });

  it("invalidates the getResume query on successful save", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByDisplayValue(TEST_RESUME.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    await screen.findByText(enCommon.resume.edit.saveSuccess);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["getResume", TEST_RESUME_ID] })
    );
  });
});

// ---------------------------------------------------------------------------
// Save — error
// ---------------------------------------------------------------------------

describe("Save — error", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(TEST_RESUME);
    mockUpdateResume.mockRejectedValue(new Error("Server error"));
  });

  it("shows error alert when updateResume fails", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_RESUME.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    const errorMsg = await screen.findByText(enCommon.resume.edit.saveError);
    expect(errorMsg).toBeInTheDocument();
  });

  it("retains the summary value after a failed save", async () => {
    const user = userEvent.setup();
    renderPage();

    const summaryInput = await screen.findByDisplayValue(TEST_RESUME.summary!);
    await user.clear(summaryInput);
    await user.type(summaryInput, "Modified summary");

    const saveBtn = screen.getByRole("button", {
      name: enCommon.resume.edit.saveButton,
    });
    await user.click(saveBtn);

    await screen.findByText(enCommon.resume.edit.saveError);

    expect(screen.getByDisplayValue("Modified summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Section headings
// ---------------------------------------------------------------------------

describe("Section headings", () => {
  it("renders the profile section heading", async () => {
    renderPage();
    const heading = await screen.findByText(enCommon.resume.edit.profileHeading);
    expect(heading).toBeInTheDocument();
  });

  it("renders the skills section heading", async () => {
    renderPage();
    const heading = await screen.findByText(enCommon.resume.edit.skillsHeading);
    expect(heading).toBeInTheDocument();
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
