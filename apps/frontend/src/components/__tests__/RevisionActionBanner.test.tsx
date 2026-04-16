/**
 * Tests for RevisionActionBanner component.
 *
 * Acceptance criteria:
 *   - Three exits visible: Review & accept / Keep editing / Discard
 *   - Review dialog: Accept (merge) + Save as separate version (promote) option
 *   - Discard opens confirm → delete branch and navigate to source
 *   - Keep editing navigates to the edit route for the revision
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { RevisionActionBanner } from "../RevisionActionBanner";

vi.mock("../../hooks/versioning", () => ({
  useMergeRevisionIntoSource: vi.fn(),
  usePromoteRevisionToVariant: vi.fn(),
  useDeleteResumeBranch: vi.fn(),
}));

import {
  useDeleteResumeBranch,
  useMergeRevisionIntoSource,
  usePromoteRevisionToVariant,
} from "../../hooks/versioning";
const mockUseMerge = useMergeRevisionIntoSource as ReturnType<typeof vi.fn>;
const mockUsePromote = usePromoteRevisionToVariant as ReturnType<typeof vi.fn>;
const mockUseDelete = useDeleteResumeBranch as ReturnType<typeof vi.fn>;

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderBanner({
  sourceName = "Tech Lead",
  sourceBranchId = "source-1" as string | null,
}: { sourceName?: string; sourceBranchId?: string | null } = {}) {
  return renderWithProviders(
    <RevisionActionBanner
      resumeId="resume-1"
      branchId="revision-1"
      sourceName={sourceName}
      sourceBranchId={sourceBranchId}
    />,
    { queryClient: buildTestQueryClient() },
  );
}

function setupIdleHooks() {
  mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mockUseDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
}

afterEach(() => vi.clearAllMocks());

describe("render", () => {
  it("shows three exit actions: review, keep editing, discard", () => {
    setupIdleHooks();
    renderBanner();

    expect(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewButton }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.keepEditingButton }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.discardButton }),
    ).toBeInTheDocument();
  });
});

describe("review & accept", () => {
  it("opens review dialog and accepts (merges into source)", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ mergedIntoBranchId: "variant-1" });
    mockUseMerge.mockReturnValue({ mutateAsync, isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner({ sourceName: "Tech Lead" });

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewButton }),
    );
    await user.click(screen.getByRole("button", { name: /Accept into Tech Lead/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ branchId: "revision-1", resumeId: "resume-1" });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "variant-1" },
    });
  });

  it("shows conflict error when accept fails with CONFLICT", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("CONFLICT"));
    mockUseMerge.mockReturnValue({ mutateAsync, isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewButton }),
    );
    await user.click(screen.getByRole("button", { name: /Accept into/i }));

    expect(
      await screen.findByText(enCommon.resume.revisionBanner.reviewDialog.acceptConflictError),
    ).toBeInTheDocument();
  });

  it("saves as separate version via expanded inline form", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync, isPending: false });
    mockUseDelete.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewButton }),
    );
    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewDialog.saveAsSeparate }),
    );
    await user.type(
      screen.getByLabelText(enCommon.resume.revisionBanner.reviewDialog.nameLabel),
      "New Variant",
    );
    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.reviewDialog.save }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        branchId: "revision-1",
        name: "New Variant",
        resumeId: "resume-1",
      });
    });
  });
});

describe("keep editing", () => {
  it("navigates to the edit route for the revision branch", async () => {
    setupIdleHooks();
    const user = userEvent.setup();
    renderBanner();

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.keepEditingButton }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/edit/branch/$branchId",
      params: { id: "resume-1", branchId: "revision-1" },
    });
  });
});

describe("discard", () => {
  it("opens confirm, deletes branch, and navigates to source", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDelete.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner({ sourceBranchId: "source-1" });

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.discardButton }),
    );
    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.discardDialog.confirm }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ branchId: "revision-1" });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "source-1" },
    });
  });

  it("navigates to resume root if source branch is unknown", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUseDelete.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner({ sourceBranchId: null });

    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.discardButton }),
    );
    await user.click(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.discardDialog.confirm }),
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/resumes/$id",
        params: { id: "resume-1" },
      });
    });
  });
});
