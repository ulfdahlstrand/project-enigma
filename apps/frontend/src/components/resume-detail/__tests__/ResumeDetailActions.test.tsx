import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test-utils/render";
import enCommon from "../../../locales/en/common.json";
import { ResumeDetailActions } from "../ResumeDetailActions";

vi.mock("../../RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown; params?: unknown },
    ref: React.Ref<HTMLAnchorElement>,
  ) {
    return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("ResumeDetailActions", () => {
  const baseProps = {
    resumeId: "resume-id-1",
    resumeTitle: "Test Resume",
    activeBranchId: "branch-id-1",
    activeBranchName: "main",
    compareBaseRef: null,
    currentCommitId: "commit-id-1",
    isEditRoute: false,
    isSnapshotMode: false,
    isEditing: false,
    isSaving: false,
    onSaveCurrent: vi.fn(),
    onCreateBranchFromCommit: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onExitEdit: vi.fn(),
    onDeleteResume: vi.fn(),
    isDeletePending: false,
    isDeleteError: false,
  };

  it("hides the edit button and offers create-branch action in snapshot mode", async () => {
    const user = userEvent.setup();
    const onCreateBranchFromCommit = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <ResumeDetailActions
        {...baseProps}
        isSnapshotMode
        onCreateBranchFromCommit={onCreateBranchFromCommit}
      />,
    );

    expect(screen.queryByRole("button", { name: enCommon.resume.detail.editButton })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: enCommon.resume.detail.moreActionsLabel }));
    await user.click(screen.getByRole("menuitem", { name: enCommon.resume.detail.createBranchFromCommitMenuItem }));

    const nameInput = screen.getByLabelText(enCommon.resume.variants.createDialog.nameLabel);
    await user.type(nameInput, "Branch from commit");
    await user.click(screen.getByRole("button", { name: enCommon.resume.variants.createDialog.create }));

    expect(onCreateBranchFromCommit).toHaveBeenCalledWith("Branch from commit");
  });
});
