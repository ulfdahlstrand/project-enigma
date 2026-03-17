/**
 * Tests for the /cv/$id/edit route — CV Editor Form.
 *
 * Acceptance criteria covered:
 *   - Renders summary textarea with the current CV value
 *   - Save button calls updateCV with the correct id and summary
 *   - Shows success alert after a successful save
 *   - Shows error alert on save failure
 *   - Shows loading state while CV is being fetched
 *   - Back button is present
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../locales/en/common.json";
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../test-utils/render";
import { Route } from "../$id.edit";

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
const mockUpdateCV = orpc.updateCV as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const TEST_CV_ID = "cv-edit-test-id";
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_CV_ID }),
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

const TEST_CV = {
  id: TEST_CV_ID,
  employeeId: "emp-id-1",
  title: "Senior Developer CV",
  summary: "Initial summary text here.",
  language: "en",
  isMain: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  skills: [
    { id: "skill-1", cvId: TEST_CV_ID, name: "TypeScript", level: "Expert", category: "Programming", sortOrder: 1 },
  ],
};

const UPDATED_CV = {
  ...TEST_CV,
  summary: "Updated summary text.",
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const CvEditPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  const result = renderWithProviders(<CvEditPage />, { queryClient });
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
});

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe("Form rendering", () => {
  beforeEach(() => {
    mockGetCV.mockResolvedValue(TEST_CV);
  });

  it("renders the page title", async () => {
    renderPage();
    const pageTitle = await screen.findByText(enCommon.cv.edit.pageTitle);
    expect(pageTitle).toBeInTheDocument();
  });

  it("renders the summary textarea with current CV summary value", async () => {
    renderPage();
    const summaryInput = await screen.findByDisplayValue(TEST_CV.summary!);
    expect(summaryInput).toBeInTheDocument();
  });

  it("renders a Save button", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_CV.summary!);
    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    expect(saveBtn).toBeInTheDocument();
  });

  it("renders a Back button", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_CV.summary!);
    const backBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.backButton,
    });
    expect(backBtn).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Save — success
// ---------------------------------------------------------------------------

describe("Save — success", () => {
  beforeEach(() => {
    mockGetCV.mockResolvedValue(TEST_CV);
    mockUpdateCV.mockResolvedValue(UPDATED_CV);
  });

  it("calls orpc.updateCV with the correct id and current summary on save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_CV.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateCV).toHaveBeenCalledWith({
        id: TEST_CV_ID,
        summary: TEST_CV.summary,
      });
    });
  });

  it("calls orpc.updateCV with updated summary after editing the field", async () => {
    const user = userEvent.setup();
    renderPage();

    const summaryInput = await screen.findByDisplayValue(TEST_CV.summary!);
    await user.clear(summaryInput);
    await user.type(summaryInput, "New summary content");

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateCV).toHaveBeenCalledWith({
        id: TEST_CV_ID,
        summary: "New summary content",
      });
    });
  });

  it("shows success alert after a successful save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_CV.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    const successMsg = await screen.findByText(enCommon.cv.edit.saveSuccess);
    expect(successMsg).toBeInTheDocument();
  });

  it("invalidates the getCV query on successful save", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByDisplayValue(TEST_CV.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    await screen.findByText(enCommon.cv.edit.saveSuccess);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["getCV", TEST_CV_ID] })
    );
  });
});

// ---------------------------------------------------------------------------
// Save — error
// ---------------------------------------------------------------------------

describe("Save — error", () => {
  beforeEach(() => {
    mockGetCV.mockResolvedValue(TEST_CV);
    mockUpdateCV.mockRejectedValue(new Error("Server error"));
  });

  it("shows error alert when updateCV fails", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_CV.summary!);

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    const errorMsg = await screen.findByText(enCommon.cv.edit.saveError);
    expect(errorMsg).toBeInTheDocument();
  });

  it("retains the summary value after a failed save", async () => {
    const user = userEvent.setup();
    renderPage();

    const summaryInput = await screen.findByDisplayValue(TEST_CV.summary!);
    await user.clear(summaryInput);
    await user.type(summaryInput, "Modified summary");

    const saveBtn = screen.getByRole("button", {
      name: enCommon.cv.edit.saveButton,
    });
    await user.click(saveBtn);

    await screen.findByText(enCommon.cv.edit.saveError);

    expect(screen.getByDisplayValue("Modified summary")).toBeInTheDocument();
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
