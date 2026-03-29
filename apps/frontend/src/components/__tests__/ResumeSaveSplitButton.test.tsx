import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import enCommon from "../../locales/en/common.json";
import { buildTestQueryClient, renderWithProviders } from "../../test-utils/render";
import { ResumeSaveSplitButton } from "../ResumeSaveSplitButton";

const mockOnSaveCurrent = vi.fn();
const mockOnSaveAsNewVersion = vi.fn();

function renderButton() {
  const queryClient = buildTestQueryClient();
  return renderWithProviders(
    <ResumeSaveSplitButton
      onSaveCurrent={mockOnSaveCurrent}
      onSaveAsNewVersion={mockOnSaveAsNewVersion}
    />,
    { queryClient }
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ResumeSaveSplitButton", () => {
  it("renders the primary save action", () => {
    renderButton();
    expect(screen.getByRole("button", { name: enCommon.resume.edit.saveButton })).toBeInTheDocument();
  });

  it("calls onSaveCurrent when the primary button is clicked", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.edit.saveButton }));

    expect(mockOnSaveCurrent).toHaveBeenCalledTimes(1);
  });

  it("opens the version naming dialog from the dropdown menu", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.edit.saveActionsLabel }));
    await user.click(screen.getByText(enCommon.resume.edit.saveAsNewVersionOption));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel)).toBeInTheDocument();
  });

  it("calls onSaveAsNewVersion with the trimmed name", async () => {
    mockOnSaveAsNewVersion.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.edit.saveActionsLabel }));
    await user.click(screen.getByText(enCommon.resume.edit.saveAsNewVersionOption));
    await user.type(screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel), "  New Variant  ");
    await user.click(screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create }));

    expect(mockOnSaveAsNewVersion).toHaveBeenCalledWith("New Variant");
  });

  it("shows an error when creating the new version fails", async () => {
    mockOnSaveAsNewVersion.mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: enCommon.resume.edit.saveActionsLabel }));
    await user.click(screen.getByText(enCommon.resume.edit.saveAsNewVersionOption));
    await user.type(screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel), "New Variant");
    await user.click(screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create }));

    expect(await screen.findByText(enCommon.resume.variants.createDialog.error)).toBeInTheDocument();
  });
});
