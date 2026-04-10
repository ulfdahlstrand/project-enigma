import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../index";
import { renderWithProviders } from "../../../../test-utils/render";

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listAIPromptConfigs: vi.fn(),
    updateAIPromptFragment: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockListAIPromptConfigs = orpc.listAIPromptConfigs as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockListAIPromptConfigs.mockResolvedValue({
    categories: [
      {
        id: "cat-1",
        key: "frontend",
        title: "Frontend Prompt Builders",
        description: "Frontend prompts",
        sortOrder: 0,
        prompts: [
          {
            id: "prompt-1",
            key: "frontend.assignment-assistant",
            title: "Assignment assistant",
            description: "Prompt for assignment improvements",
            sourceFile: "apps/frontend/src/components/ai-assistant/lib/build-assignment-prompt.ts",
            isEditable: true,
            sortOrder: 0,
            fragments: [
              {
                id: "fragment-1",
                key: "system_template",
                label: "System template",
                content: "Current description: {{description}}",
                sortOrder: 0,
              },
            ],
          },
          {
            id: "prompt-2",
            key: "backend.conversation-title",
            title: "Conversation title generator",
            description: "Prompt for short titles",
            sourceFile: "apps/backend/src/domains/ai/lib/generate-title.ts",
            isEditable: true,
            sortOrder: 1,
            fragments: [
              {
                id: "fragment-2",
                key: "system_template",
                label: "System template",
                content: "You summarise conversations in 2–4 words.",
                sortOrder: 0,
              },
            ],
          },
        ],
      },
    ],
  });
});

describe("admin prompt inventory page", () => {
  it("renders the live prompt inventory overview", async () => {
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Frontend Prompt Builders")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "AI Prompt Configuration" })).toBeInTheDocument();
    expect(screen.getAllByText(/System function:/)).not.toHaveLength(0);
    expect(screen.getByText("Prompt for assignment improvements")).toBeInTheDocument();
    expect(screen.getByText("Key cross-cutting rules")).toBeInTheDocument();
  });

  it("filters prompt locations by search text", async () => {
    const user = userEvent.setup();
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Conversation title generator")).toBeInTheDocument();
    });

    await user.type(
      screen.getByRole("textbox", { name: "Search prompt functions" }),
      "generate-title",
    );

    expect(screen.getByText("Conversation title generator")).toBeInTheDocument();
    expect(screen.queryByText("Assignment assistant")).not.toBeInTheDocument();
  });
});
