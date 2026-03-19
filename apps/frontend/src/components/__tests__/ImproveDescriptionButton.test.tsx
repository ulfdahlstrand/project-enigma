/**
 * Tests for ImproveDescriptionButton component.
 *
 * Acceptance criteria:
 *   - Renders the improve button
 *   - Shows spinner while pending
 *   - Shows AI suggestion and accept/reject buttons on success
 *   - Accept calls onAccept with improved text and clears the preview
 *   - Reject clears the preview
 *   - Shows error alert on failure
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders } from "../../test-utils/render";
import { ImproveDescriptionButton } from "../ImproveDescriptionButton";

// ---------------------------------------------------------------------------
// Mock orpc client
// ---------------------------------------------------------------------------

const mockImproveDescription = vi.fn();

vi.mock("../../orpc-client", () => ({
  orpc: {
    improveDescription: (...args: unknown[]) => mockImproveDescription(...args),
  },
}));

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderButton(
  props: {
    description?: string;
    role?: string;
    clientName?: string;
    onAccept?: (text: string) => void;
  } = {}
) {
  const {
    description = "Original description.",
    role,
    clientName,
    onAccept = vi.fn(),
  } = props;

  return renderWithProviders(
    <ImproveDescriptionButton
      description={description}
      role={role}
      clientName={clientName}
      onAccept={onAccept}
    />
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Button renders
// ---------------------------------------------------------------------------

describe("Button rendering", () => {
  it("renders the improve button", () => {
    renderButton();
    expect(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    ).toBeInTheDocument();
  });

  it("does not show AI suggestion preview initially", () => {
    renderButton();
    expect(
      screen.queryByLabelText(enCommon.assignment.detail.ai.previewLabel)
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pending state
// ---------------------------------------------------------------------------

describe("Pending state", () => {
  it("shows spinner and disables button while pending", async () => {
    // Never resolve so we can observe pending state
    mockImproveDescription.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderButton();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    );

    const button = screen.getByRole("button", {
      name: new RegExp(enCommon.assignment.detail.ai.improving),
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

describe("Success state", () => {
  it("shows AI suggestion and accept/reject buttons on success", async () => {
    mockImproveDescription.mockResolvedValue({
      improvedDescription: "Improved text from AI.",
    });
    const user = userEvent.setup();
    renderButton();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(enCommon.assignment.detail.ai.previewLabel)
      ).toBeInTheDocument()
    );

    expect(screen.getByDisplayValue("Improved text from AI.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: enCommon.assignment.detail.ai.acceptButton })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: enCommon.assignment.detail.ai.rejectButton })
    ).toBeInTheDocument();
  });

  it("calls onAccept with the improved text when Accept is clicked", async () => {
    mockImproveDescription.mockResolvedValue({
      improvedDescription: "Improved text from AI.",
    });
    const onAccept = vi.fn();
    const user = userEvent.setup();
    renderButton({ onAccept });

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(enCommon.assignment.detail.ai.previewLabel)
      ).toBeInTheDocument()
    );

    await user.click(
      screen.getByRole("button", { name: enCommon.assignment.detail.ai.acceptButton })
    );

    expect(onAccept).toHaveBeenCalledWith("Improved text from AI.");
    expect(
      screen.queryByLabelText(enCommon.assignment.detail.ai.previewLabel)
    ).toBeNull();
  });

  it("clears the preview when Reject is clicked", async () => {
    mockImproveDescription.mockResolvedValue({
      improvedDescription: "Improved text from AI.",
    });
    const user = userEvent.setup();
    renderButton();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(enCommon.assignment.detail.ai.previewLabel)
      ).toBeInTheDocument()
    );

    await user.click(
      screen.getByRole("button", { name: enCommon.assignment.detail.ai.rejectButton })
    );

    expect(
      screen.queryByLabelText(enCommon.assignment.detail.ai.previewLabel)
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("Error state", () => {
  it("shows error alert on failure", async () => {
    mockImproveDescription.mockRejectedValue(new Error("API error"));
    const user = userEvent.setup();
    renderButton();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    );

    const errorAlert = await screen.findByText(
      enCommon.assignment.detail.ai.improveError
    );
    expect(errorAlert).toBeInTheDocument();
  });
});
