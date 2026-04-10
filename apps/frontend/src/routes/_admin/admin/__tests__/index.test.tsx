import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../assistant/prompts/index";
import { renderWithProviders } from "../../../../test-utils/render";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listAIPromptConfigs: vi.fn(),
    updateAIPromptFragment: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockListAIPromptConfigs = orpc.listAIPromptConfigs as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockNavigate.mockReset();
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
  it("renders the prompt overview as a list of categories and entries", async () => {
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Frontend Prompt Builders")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "AI Prompt Configuration" })).toBeInTheDocument();
    expect(screen.getByText("Prompt for assignment improvements")).toBeInTheDocument();
    expect(screen.getByText("Assignment assistant")).toBeInTheDocument();
    expect(screen.getByText("Conversation title generator")).toBeInTheDocument();
    expect(screen.getAllByText("Editable")).toHaveLength(2);
  });

  it("filters prompts by their system function", async () => {
    const user = userEvent.setup();
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Conversation title generator")).toBeInTheDocument();
    });

    await user.type(
      screen.getByRole("textbox", { name: "Search prompt functions" }),
      "short titles",
    );

    await waitFor(() => {
      expect(screen.getByText("Conversation title generator")).toBeInTheDocument();
    });
    expect(screen.queryByText("Assignment assistant")).not.toBeInTheDocument();
  });

  it("navigates to the prompt detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Assignment assistant")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Assignment assistant/i }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/admin/assistant/prompts/prompt-1",
    });
  });
});
