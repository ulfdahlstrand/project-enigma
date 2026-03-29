/**
 * Tests for SaveVersionButton component.
 *
 * Acceptance criteria:
 *   - Renders the "Save version" button
 *   - Clicking button opens the dialog
 *   - Dialog shows title and message field
 *   - Cancel closes the dialog
 *   - Confirm calls useSaveResumeVersion.mutateAsync with branchId
 *   - Confirm calls with optional message when typed
 *   - Success snackbar appears after save
 *   - Error alert appears when save fails
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { SaveVersionButton } from "../SaveVersionButton";

// ---------------------------------------------------------------------------
// Mock versioning hook
// ---------------------------------------------------------------------------

const mockMutateAsync = vi.fn();
let mockIsPending = false;

vi.mock("../../hooks/versioning", () => ({
  useSaveResumeVersion: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}));

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderButton(branchId = "branch-id-1") {
  const queryClient = buildTestQueryClient();
  return renderWithProviders(<SaveVersionButton branchId={branchId} />, { queryClient });
}

afterEach(() => {
  vi.clearAllMocks();
  mockIsPending = false;
});

// ---------------------------------------------------------------------------
// Button renders
// ---------------------------------------------------------------------------

describe("Button rendering", () => {
  it("renders the save version button", () => {
    renderButton();
    expect(screen.getByText(enCommon.resume.saveVersion.button)).toBeInTheDocument();
  });

  it("does not show the dialog initially", () => {
    renderButton();
    // Dialog should not be open — check via role rather than text (button text = dialog title)
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dialog open/close
// ---------------------------------------------------------------------------

describe("Dialog open and close", () => {
  it("opens dialog when button is clicked", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.cancel));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders the message placeholder in the text field", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByText(enCommon.resume.saveVersion.button));
    expect(
      screen.getByPlaceholderText(enCommon.resume.saveVersion.messagePlaceholder)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Save without message
// ---------------------------------------------------------------------------

describe("Save without message", () => {
  it("calls mutateAsync with only branchId when message is empty", async () => {
    mockMutateAsync.mockResolvedValue({ id: "commit-new" });
    const user = userEvent.setup();
    renderButton("branch-id-1");

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    expect(mockMutateAsync).toHaveBeenCalledWith({ branchId: "branch-id-1" });
  });

  it("closes dialog after successful save", async () => {
    mockMutateAsync.mockResolvedValue({ id: "commit-new" });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows success snackbar after save", async () => {
    mockMutateAsync.mockResolvedValue({ id: "commit-new" });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    expect(await screen.findByText(enCommon.resume.saveVersion.success)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Save with message
// ---------------------------------------------------------------------------

describe("Save with message", () => {
  it("calls mutateAsync with branchId and trimmed message", async () => {
    mockMutateAsync.mockResolvedValue({ id: "commit-new" });
    const user = userEvent.setup();
    renderButton("branch-id-1");

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    const input = screen.getByPlaceholderText(enCommon.resume.saveVersion.messagePlaceholder);
    await user.type(input, "  My version message  ");
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      branchId: "branch-id-1",
      message: "My version message",
    });
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("renders error alert when save fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Save failed"));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    const errorAlert = await screen.findByText(enCommon.resume.saveVersion.error);
    expect(errorAlert).toBeInTheDocument();
  });

  it("keeps dialog open when save fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Save failed"));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.saveVersion.button }));
    await user.click(screen.getByText(enCommon.resume.saveVersion.save));

    await screen.findByText(enCommon.resume.saveVersion.error);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
