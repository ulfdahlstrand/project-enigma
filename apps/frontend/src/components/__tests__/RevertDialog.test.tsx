/**
 * Tests for RevertDialog — preview + confirm restoring a prior snapshot.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders } from "../../test-utils/render";
import { RevertDialog } from "../RevertDialog";

describe("RevertDialog", () => {
  it("shows the target label and calls onConfirm", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <RevertDialog
        open
        targetLabel="Before summary rewrite"
        isPending={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Before summary rewrite")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revertDialog.confirm }),
    );
    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders an error when provided", () => {
    renderWithProviders(
      <RevertDialog
        open
        targetLabel="Target"
        isPending={false}
        error="Boom"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
