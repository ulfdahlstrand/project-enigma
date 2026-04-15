import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test-utils/render";
import { ResumeHistoryDrawer } from "../ResumeHistoryDrawer";

vi.mock("../../RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown; params?: unknown },
    ref: React.Ref<HTMLAnchorElement>,
  ) {
    return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
  }),
}));

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

  it("links to the branch-specific history route when an active branch exists", async () => {
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

    expect(await screen.findByRole("link", { name: /View full history/i })).toHaveAttribute(
      "href",
      "/resumes/$id/history/branch/$branchId",
    );
  });
});
