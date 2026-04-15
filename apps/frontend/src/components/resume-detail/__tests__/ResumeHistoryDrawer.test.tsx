import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test-utils/render";
import { ResumeHistoryDrawer } from "../ResumeHistoryDrawer";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ResumeHistoryDrawer", () => {
  const recentCommits = [
    { id: "commit-3", title: "Current commit", createdAt: "2024-06-03T10:00:00Z" },
    { id: "commit-2", title: "Previous commit", createdAt: "2024-06-02T10:00:00Z" },
  ];

  it("highlights the currently viewed commit", async () => {
    renderWithProviders(
      <ResumeHistoryDrawer
        open
        onClose={() => undefined}
        resumeId="resume-id-1"
        activeBranchId="branch-id-1"
        activeBranchName="main"
        currentCommitId="commit-3"
        recentCommits={recentCommits}
        language="en"
      />,
    );

    expect(await screen.findByRole("button", { name: /Current commit/i })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Previous commit/i })).not.toHaveAttribute("aria-current");
  });

  it("navigates to the branch-specific history route when 'View full history' is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <ResumeHistoryDrawer
        open
        onClose={onClose}
        resumeId="resume-id-1"
        activeBranchId="branch-id-1"
        activeBranchName="main"
        currentCommitId="commit-3"
        recentCommits={recentCommits}
        language="en"
      />,
    );

    const viewAllBtn = await screen.findByRole("button", { name: /View full history/i });
    await user.click(viewAllBtn);

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/resumes/$id/history/branch/$branchId",
        params: { id: "resume-id-1", branchId: "branch-id-1" },
      }),
    );
  });
});
