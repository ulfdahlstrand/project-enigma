import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../../test-utils/render";
import { LanguageLinkBadge } from "./LanguageLinkBadge";
import type { CommitTagWithLinkedResume } from "@cv-tool/contracts";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const RESUME_ID = "550e8400-e29b-41d4-a716-446655440021";
const OTHER_RESUME_ID = "550e8400-e29b-41d4-a716-446655440022";
const SOURCE_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440061";
const TARGET_COMMIT_ID = "550e8400-e29b-41d4-a716-446655440062";

const TAG: CommitTagWithLinkedResume = {
  id: "550e8400-e29b-41d4-a716-446655440071",
  sourceCommitId: SOURCE_COMMIT_ID,
  targetCommitId: TARGET_COMMIT_ID,
  kind: "translation",
  createdAt: new Date("2026-04-17T10:00:00.000Z"),
  createdBy: null,
  source: {
    resumeId: RESUME_ID,
    resumeTitle: "Swedish CV",
    language: "sv",
    commitId: SOURCE_COMMIT_ID,
    branchId: null,
    branchName: null,
  },
  target: {
    resumeId: OTHER_RESUME_ID,
    resumeTitle: "English CV",
    language: "en",
    commitId: TARGET_COMMIT_ID,
    branchId: null,
    branchName: null,
  },
};

describe("LanguageLinkBadge", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("shows the language of the OTHER side of the tag (target when viewing source)", () => {
    renderWithProviders(<LanguageLinkBadge tag={TAG} currentResumeId={RESUME_ID} />);
    expect(screen.getByTestId("language-link-badge")).toHaveTextContent("EN");
  });

  it("shows the source side language when viewing the target resume", () => {
    renderWithProviders(<LanguageLinkBadge tag={TAG} currentResumeId={OTHER_RESUME_ID} />);
    expect(screen.getByTestId("language-link-badge")).toHaveTextContent("SV");
  });

  it("navigates to the linked resume + commit on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageLinkBadge tag={TAG} currentResumeId={RESUME_ID} />);
    await user.click(screen.getByTestId("language-link-badge"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id",
      params: { id: OTHER_RESUME_ID },
      hash: TARGET_COMMIT_ID,
    });
  });

  it("sets data attributes so parent rows can style based on linked target", () => {
    renderWithProviders(<LanguageLinkBadge tag={TAG} currentResumeId={RESUME_ID} />);
    const badge = screen.getByTestId("language-link-badge");
    expect(badge).toHaveAttribute("data-linked-resume-id", OTHER_RESUME_ID);
    expect(badge).toHaveAttribute("data-linked-commit-id", TARGET_COMMIT_ID);
  });
});
