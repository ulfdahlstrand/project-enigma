/**
 * Tests for AssignmentEditor component.
 *
 * Acceptance criteria:
 *   - Renders all assignments in read-only mode with correct role/client text
 *   - Edit icon button switches the card to edit mode with populated fields
 *   - Cancel returns to read-only mode without saving
 *   - Save calls orpc.updateAssignment with correct id and changed fields
 *   - isCurrent checkbox disables the end-date field when checked
 *   - Save button is disabled while mutation is pending
 *   - Error alert appears on mutation failure
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../test-utils/render";
import { AssignmentEditor, type AssignmentRow } from "../AssignmentEditor";
import enCommon from "../../locales/en/common.json";

// ---------------------------------------------------------------------------
// Mock oRPC client
// ---------------------------------------------------------------------------

const mockUpdateAssignment = vi.fn();

vi.mock("../../orpc-client", () => ({
  orpc: {
    updateAssignment: (...args: unknown[]) => mockUpdateAssignment(...args),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const A1: AssignmentRow = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  role: "Senior Developer",
  clientName: "Acme Corp",
  description: "Built stuff.\n\nMore stuff.",
  startDate: "2022-01-15",
  endDate: "2023-06-30",
  technologies: ["TypeScript", "React"],
  isCurrent: false,
  keywords: "frontend",
};

const A2: AssignmentRow = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  role: "Tech Lead",
  clientName: "Globex",
  description: "Led a team.",
  startDate: "2023-07-01",
  endDate: null,
  technologies: [],
  isCurrent: true,
  keywords: null,
};

const QUERY_KEY = ["listBranchAssignmentsFull", "branch-1"] as const;

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderEditor(assignments = [A1, A2]) {
  return renderWithProviders(
    <AssignmentEditor assignments={assignments} queryKey={QUERY_KEY} />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssignmentEditor", () => {
  it("renders all assignments in read-only mode", () => {
    renderEditor();

    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText("Tech Lead")).toBeInTheDocument();
    expect(screen.getByText(/Globex/)).toBeInTheDocument();
  });

  it("renders description paragraphs", () => {
    renderEditor();
    expect(screen.getByText("Built stuff.")).toBeInTheDocument();
    expect(screen.getByText("More stuff.")).toBeInTheDocument();
  });

  it("renders technologies", () => {
    renderEditor();
    expect(screen.getByText(/TypeScript, React/)).toBeInTheDocument();
  });

  it("shows edit icon buttons in read-only mode", () => {
    renderEditor();
    const editButtons = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    expect(editButtons).toHaveLength(2);
  });

  it("switches card to edit mode with pre-populated role field", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [firstEdit] = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    await user.click(firstEdit!);

    const roleInput = screen.getByDisplayValue("Senior Developer");
    expect(roleInput).toBeInTheDocument();
  });

  it("pre-populates clientName field when editing", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [firstEdit] = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    await user.click(firstEdit!);

    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("pre-populates description field when editing", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [firstEdit] = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    await user.click(firstEdit!);

    const descriptionField = screen.getByRole("textbox", {
      name: new RegExp(enCommon.assignment.detail.descriptionLabel, "i"),
    });
    expect(descriptionField).toHaveValue(A1.description);
  });

  it("cancel discards changes and returns to read-only", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [firstEdit] = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    await user.click(firstEdit!);

    // Verify edit mode
    expect(screen.getByDisplayValue("Senior Developer")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.edit.assignment.cancelButton })
    );

    // Back to read-only — role text visible again
    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(mockUpdateAssignment).not.toHaveBeenCalled();
  });

  it("calls updateAssignment with only changed fields on save", async () => {
    mockUpdateAssignment.mockResolvedValue({});
    const user = userEvent.setup();
    renderEditor();

    const [firstEdit] = screen.getAllByRole("button", {
      name: enCommon.resume.edit.assignment.editButton,
    });
    await user.click(firstEdit!);

    // Change role
    const roleInput = screen.getByDisplayValue("Senior Developer");
    await user.clear(roleInput);
    await user.type(roleInput, "Principal Engineer");

    await user.click(
      screen.getByRole("button", { name: enCommon.assignment.detail.saveButton })
    );

    await waitFor(() => expect(mockUpdateAssignment).toHaveBeenCalledOnce());
    const call = mockUpdateAssignment.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.id).toBe(A1.id);
    expect(call.role).toBe("Principal Engineer");
    // clientName unchanged — should not be in payload
    expect(call.clientName).toBeUndefined();
  });

  it("does not include unchanged fields in payload", async () => {
    mockUpdateAssignment.mockResolvedValue({});
    const user = userEvent.setup();
    renderEditor([A1]);

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.edit.assignment.editButton })
    );

    // Save immediately without changing anything
    await user.click(
      screen.getByRole("button", { name: enCommon.assignment.detail.saveButton })
    );

    await waitFor(() => expect(mockUpdateAssignment).toHaveBeenCalledOnce());
    const call = mockUpdateAssignment.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.id).toBe(A1.id);
    expect(call.role).toBeUndefined();
    expect(call.clientName).toBeUndefined();
    expect(call.description).toBeUndefined();
  });

  it("checking isCurrent disables the end-date field", async () => {
    const user = userEvent.setup();
    renderEditor([A1]);

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.edit.assignment.editButton })
    );

    const isCurrentCheckbox = screen.getByRole("checkbox");
    expect(isCurrentCheckbox).not.toBeChecked();

    await user.click(isCurrentCheckbox);

    const endDateInput = screen.getByLabelText(
      new RegExp(enCommon.assignment.detail.endDateLabel, "i")
    );
    expect(endDateInput).toBeDisabled();
  });

  it("shows error alert when mutation fails", async () => {
    mockUpdateAssignment.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderEditor([A1]);

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.edit.assignment.editButton })
    );
    await user.click(
      screen.getByRole("button", { name: enCommon.assignment.detail.saveButton })
    );

    await waitFor(() =>
      expect(
        screen.getByText(enCommon.resume.edit.assignment.saveError)
      ).toBeInTheDocument()
    );
  });
});
