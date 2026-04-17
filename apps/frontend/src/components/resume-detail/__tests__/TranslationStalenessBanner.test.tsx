import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, buildTestQueryClient } from "../../../test-utils/render";
import { TranslationStalenessBanner } from "../TranslationStalenessBanner";

vi.mock("../../../hooks/versioning", () => ({
  useGetTranslationStatus: vi.fn(),
  useCreateCommitTag: vi.fn(),
}));

import { useGetTranslationStatus, useCreateCommitTag } from "../../../hooks/versioning";
const mockUseStatus = useGetTranslationStatus as ReturnType<typeof vi.fn>;
const mockUseCreateTag = useCreateCommitTag as ReturnType<typeof vi.fn>;

const DEFAULT_PROPS = {
  sourceResumeId: "resume-sv-1",
  targetResumeId: "resume-en-1",
  targetHeadCommitId: "commit-en-head",
  sourceName: "Swedish CV",
};

function renderBanner(props = {}) {
  return renderWithProviders(
    <TranslationStalenessBanner {...DEFAULT_PROPS} {...props} />,
    { queryClient: buildTestQueryClient() }
  );
}

afterEach(() => vi.clearAllMocks());

describe("TranslationStalenessBanner", () => {
  it("renders nothing when translation is not stale", () => {
    mockUseStatus.mockReturnValue({ data: { isStale: false, latestTag: null, sourceHeadCommitId: null } });
    mockUseCreateTag.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is undefined", () => {
    mockUseStatus.mockReturnValue({ data: undefined });
    mockUseCreateTag.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders warning banner when stale", () => {
    mockUseStatus.mockReturnValue({
      data: {
        isStale: true,
        latestTag: { sourceCommitId: "commit-sv-old" },
        sourceHeadCommitId: "commit-sv-head",
      },
    });
    mockUseCreateTag.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderBanner();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls createTag with correct commit ids on mark caught up", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockUseStatus.mockReturnValue({
      data: {
        isStale: true,
        latestTag: { sourceCommitId: "commit-sv-old" },
        sourceHeadCommitId: "commit-sv-head",
      },
    });
    mockUseCreateTag.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderBanner();

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        sourceCommitId: "commit-sv-head",
        targetCommitId: "commit-en-head",
        sourceResumeId: "resume-sv-1",
        targetResumeId: "resume-en-1",
      });
    });
  });
});
