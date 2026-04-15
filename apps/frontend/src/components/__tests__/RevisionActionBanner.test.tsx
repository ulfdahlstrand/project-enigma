/**
 * Tests for RevisionActionBanner component.
 *
 * Acceptance criteria:
 *   - Renders banner with title, description and both action buttons
 *   - Merge button label includes the source variant name
 *   - Merge success: calls mutateAsync and navigates to merged branch
 *   - Merge conflict error: shows conflict error message
 *   - Merge generic error: shows generic error message
 *   - Promote: opens dialog on button click
 *   - Promote: Create button disabled when name is empty
 *   - Promote success: calls mutateAsync and navigates
 *   - Promote failure: shows error message in dialog
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../test-utils/render";
import { RevisionActionBanner } from "../RevisionActionBanner";

// ---------------------------------------------------------------------------
// Mock versioning hooks
// ---------------------------------------------------------------------------

vi.mock("../../hooks/versioning", () => ({
  useMergeRevisionIntoSource: vi.fn(),
  usePromoteRevisionToVariant: vi.fn(),
}));

import { useMergeRevisionIntoSource, usePromoteRevisionToVariant } from "../../hooks/versioning";
const mockUseMerge = useMergeRevisionIntoSource as ReturnType<typeof vi.fn>;
const mockUsePromote = usePromoteRevisionToVariant as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderBanner(sourceName = "Tech Lead") {
  return renderWithProviders(
    <RevisionActionBanner resumeId="resume-1" branchId="revision-1" sourceName={sourceName} />,
    { queryClient: buildTestQueryClient() },
  );
}

afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

describe("render", () => {
  it("shows the banner title and description", () => {
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner("Tech Lead");
    expect(screen.getByText(enCommon.resume.revisionBanner.title)).toBeInTheDocument();
    // Description is interpolated — resolve the template manually
    const expectedDescription = enCommon.resume.revisionBanner.description.replace(
      "{{sourceName}}",
      "Tech Lead",
    );
    expect(screen.getByText(expectedDescription)).toBeInTheDocument();
  });

  it("shows merge button with source name", () => {
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner("Tech Lead");
    expect(
      screen.getByRole("button", { name: /Merge into Tech Lead/i }),
    ).toBeInTheDocument();
  });

  it("shows promote button", () => {
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteButton }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

describe("merge", () => {
  it("calls mutateAsync and navigates on success", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ mergedIntoBranchId: "variant-1" });
    mockUseMerge.mockReturnValue({ mutateAsync, isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner("Tech Lead");

    await user.click(screen.getByRole("button", { name: /Merge into Tech Lead/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ branchId: "revision-1", resumeId: "resume-1" });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "variant-1" },
    });
  });

  it("shows conflict error when merge throws with CONFLICT in message", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("CONFLICT: source advanced"));
    mockUseMerge.mockReturnValue({ mutateAsync, isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner("Tech Lead");

    await user.click(screen.getByRole("button", { name: /Merge into Tech Lead/i }));

    expect(await screen.findByText(enCommon.resume.revisionBanner.mergeConflictError)).toBeInTheDocument();
  });

  it("shows generic error when merge throws without CONFLICT", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("network failure"));
    mockUseMerge.mockReturnValue({ mutateAsync, isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner("Tech Lead");

    await user.click(screen.getByRole("button", { name: /Merge into Tech Lead/i }));

    expect(await screen.findByText(enCommon.resume.revisionBanner.mergeError)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Promote
// ---------------------------------------------------------------------------

describe("promote", () => {
  it("opens the promote dialog when Promote button is clicked", async () => {
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteButton }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Use heading role to distinguish dialog title from the "Promote to variant" button
    expect(
      screen.getByRole("heading", { name: enCommon.resume.revisionBanner.promoteDialog.title }),
    ).toBeInTheDocument();
  });

  it("keeps Promote button disabled when name is empty", async () => {
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteButton }));

    expect(
      screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteDialog.promote }),
    ).toBeDisabled();
  });

  it("calls mutateAsync and navigates on successful promote", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteButton }));
    await user.type(
      screen.getByLabelText(enCommon.resume.revisionBanner.promoteDialog.nameLabel),
      "New Variant",
    );
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteDialog.promote }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        branchId: "revision-1",
        name: "New Variant",
        resumeId: "resume-1",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: "resume-1", branchId: "revision-1" },
    });
  });

  it("shows error message when promote fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("server error"));
    mockUseMerge.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mockUsePromote.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteButton }));
    await user.type(
      screen.getByLabelText(enCommon.resume.revisionBanner.promoteDialog.nameLabel),
      "Bad Variant",
    );
    await user.click(screen.getByRole("button", { name: enCommon.resume.revisionBanner.promoteDialog.promote }));

    expect(await screen.findByText(enCommon.resume.revisionBanner.promoteDialog.error)).toBeInTheDocument();
  });
});
