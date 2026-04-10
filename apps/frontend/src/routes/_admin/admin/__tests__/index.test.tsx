import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { Route } from "../index";

describe("admin prompt inventory page", () => {
  it("renders the prompt inventory overview", () => {
    const Component = Route.options.component as ComponentType;

    render(<Component />);

    expect(screen.getByRole("heading", { name: "AI Prompt Inventory" })).toBeInTheDocument();
    expect(screen.getByText("Frontend prompt builders")).toBeInTheDocument();
    expect(
      screen.getByText(
        "apps/frontend/src/components/ai-assistant/lib/build-resume-revision-prompt.ts",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Key cross-cutting rules")).toBeInTheDocument();
  });

  it("filters prompt locations by search text", async () => {
    const user = userEvent.setup();
    const Component = Route.options.component as ComponentType;

    render(<Component />);

    await user.type(
      screen.getByRole("textbox", { name: "Search prompt locations" }),
      "generate-title",
    );

    expect(screen.getByText("generate-title.ts")).toBeInTheDocument();
    expect(screen.queryByText("build-assignment-prompt.ts")).not.toBeInTheDocument();
  });
});
