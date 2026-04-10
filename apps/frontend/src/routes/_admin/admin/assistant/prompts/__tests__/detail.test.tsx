import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../$promptId";
import { renderWithProviders } from "../../../../../../test-utils/render";

const mockParams = { promptId: "prompt-1" };

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({ children, to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    useParams: () => mockParams,
  };
});

const updateAIPromptFragmentMock = vi.fn();

vi.mock("../../../../../../orpc-client", () => ({
  orpc: {
    listAIPromptConfigs: vi.fn(),
    updateAIPromptFragment: (...args: unknown[]) => updateAIPromptFragmentMock(...args),
  },
}));

import { orpc } from "../../../../../../orpc-client";

const mockListAIPromptConfigs = orpc.listAIPromptConfigs as ReturnType<typeof vi.fn>;

beforeEach(() => {
  updateAIPromptFragmentMock.mockReset();
  updateAIPromptFragmentMock.mockResolvedValue({
    fragmentId: "fragment-kickoff",
    content: "Updated kickoff instructions",
  });

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
            key: "frontend.unified-revision",
            title: "Unified revision assistant",
            description: "Coordinates multi-step resume revisions",
            isEditable: true,
            sortOrder: 0,
            fragments: [
              {
                id: "fragment-system",
                key: "system_template",
                label: "System template",
                content: "System template content",
                sortOrder: 5,
              },
              {
                id: "fragment-kickoff",
                key: "kickoff_message",
                label: "Kickoff message",
                content: "Kickoff instructions",
                sortOrder: 99,
              },
            ],
          },
        ],
      },
    ],
  });
});

describe("admin prompt detail page", () => {
  it("shows prompt fragments with kickoff before system template", async () => {
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Unified revision assistant" }),
      ).toBeInTheDocument();
    });

    const headings = [
      screen.getByText("Kickoff message", { selector: "h6" }),
      screen.getByText("System template", { selector: "h6" }),
    ];
    expect(headings.map((node) => node.textContent)).toEqual([
      "Kickoff message",
      "System template",
    ]);
  });

  it("saves edited fragment content", async () => {
    const Component = Route.options.component as ComponentType;

    renderWithProviders(<Component />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Kickoff instructions")).toBeInTheDocument();
    });

    const fields = screen.getAllByRole("textbox");
    fireEvent.change(fields[0]!, {
      target: { value: "Updated kickoff instructions" },
    });
    const saveButtons = screen
      .getAllByRole("button", { name: "Save" })
      .filter((button) => !button.hasAttribute("disabled"));
    fireEvent.click(saveButtons[0]!);

    await waitFor(() => {
      expect(updateAIPromptFragmentMock).toHaveBeenCalledWith({
        fragmentId: "fragment-kickoff",
        content: "Updated kickoff instructions",
      });
    });
  });
});
