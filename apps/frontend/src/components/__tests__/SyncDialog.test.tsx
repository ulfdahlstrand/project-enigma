/**
 * Tests for the shared SyncDialog wizard (revision + translation flavours).
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders } from "../../test-utils/render";
import { SyncDialog } from "../SyncDialog";

describe("SyncDialog", () => {
  it("shows the translation flavour copy when flavour=translation", () => {
    renderWithProviders(
      <SyncDialog
        open
        flavour="translation"
        sourceName="English version"
        isPending={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByText(enCommon.resume.syncDialog.translation.step1Heading),
    ).toBeInTheDocument();
  });

  it("advances to step 2 and calls onConfirm", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SyncDialog
        open
        flavour="revision"
        sourceName="Tech Lead"
        isPending={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: enCommon.resume.syncDialog.next }));
    await user.click(
      screen.getByRole("button", {
        name: enCommon.resume.syncDialog.revision.confirmButton,
      }),
    );

    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders an error message when error is set", () => {
    renderWithProviders(
      <SyncDialog
        open
        flavour="revision"
        sourceName="Tech Lead"
        isPending={false}
        error="Boom"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
