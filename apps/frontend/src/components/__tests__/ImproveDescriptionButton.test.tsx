/**
 * Tests for ImproveDescriptionButton component.
 *
 * Acceptance criteria:
 *   - Renders the improve button
 *   - Clicking it calls openAssistant with correct entity info, system prompt, and callbacks
 *   - Does NOT render inline preview states (those are handled inside the panel)
 */
import { beforeEach, describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders } from "../../test-utils/render";
import { ImproveDescriptionButton } from "../ImproveDescriptionButton";

// ---------------------------------------------------------------------------
// Mock AI assistant context
// ---------------------------------------------------------------------------

const mockOpenAssistant = vi.fn();
const mockLoadPromptFragments = vi.fn();

vi.mock("../../lib/ai-assistant-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ai-assistant-context")>();
  return {
    ...actual,
    useAIAssistantContext: () => ({
      openAssistant: mockOpenAssistant,
      isOpen: false,
      closeAssistant: vi.fn(),
    }),
  };
});

vi.mock("../../features/admin/prompt-config-client", () => ({
  loadPromptFragments: (...args: unknown[]) => mockLoadPromptFragments(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  mockLoadPromptFragments.mockResolvedValue({
    system_template: "Current description: {{description}}",
    kickoff_message: "Improve the assignment description.",
  });
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440001";

function renderButton(props: {
  description?: string;
  role?: string;
  clientName?: string;
  onAccept?: (text: string) => void;
} = {}) {
  const {
    description = "Original description.",
    role,
    clientName,
    onAccept = vi.fn(),
  } = props;

  return renderWithProviders(
    <ImproveDescriptionButton
      assignmentId={ASSIGNMENT_ID}
      description={description}
      role={role}
      clientName={clientName}
      onAccept={onAccept}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImproveDescriptionButton", () => {
  it("renders the improve button", () => {
    renderButton();
    expect(
      screen.getByRole("button", {
        name: new RegExp(enCommon.assignment.detail.ai.improveButton),
      })
    ).toBeInTheDocument();
  });

  it("calls openAssistant with correct entityType and entityId when clicked", async () => {
    const user = userEvent.setup();
    renderButton({ description: "My description." });

    await user.click(
      screen.getByRole("button", { name: new RegExp(enCommon.assignment.detail.ai.improveButton) })
    );

    await waitFor(() => {
      expect(mockOpenAssistant).toHaveBeenCalledOnce();
    });
    const args = mockOpenAssistant.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.entityType).toBe("assignment");
    expect(args.entityId).toBe(ASSIGNMENT_ID);
  });

  it("passes originalContent to openAssistant", async () => {
    const user = userEvent.setup();
    renderButton({ description: "Some original text." });

    await user.click(
      screen.getByRole("button", { name: new RegExp(enCommon.assignment.detail.ai.improveButton) })
    );

    await waitFor(() => {
      expect(mockOpenAssistant).toHaveBeenCalledOnce();
    });
    const args = mockOpenAssistant.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.originalContent).toBe("Some original text.");
  });

  it("passes onAccept callback to openAssistant", async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();
    renderButton({ onAccept });

    await user.click(
      screen.getByRole("button", { name: new RegExp(enCommon.assignment.detail.ai.improveButton) })
    );

    await waitFor(() => {
      expect(mockOpenAssistant).toHaveBeenCalledOnce();
    });
    const args = mockOpenAssistant.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof args.onAccept).toBe("function");
    (args.onAccept as (text: string) => void)("improved text");
    expect(onAccept).toHaveBeenCalledWith("improved text");
  });

  it("does not render inline preview states", () => {
    renderButton();
    expect(screen.queryByLabelText(enCommon.assignment.detail.ai.previewLabel)).toBeNull();
    expect(screen.queryByRole("button", { name: enCommon.assignment.detail.ai.acceptButton })).toBeNull();
    expect(screen.queryByRole("button", { name: enCommon.assignment.detail.ai.rejectButton })).toBeNull();
  });
});
