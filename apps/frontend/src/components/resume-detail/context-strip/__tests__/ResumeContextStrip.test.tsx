/**
 * Tests for ResumeContextStrip.
 *
 * Acceptance criteria:
 *   1. Variant chip renders branch name
 *   2. Language chip renders current language code/label
 *   3. Draft chip shows "Synced" in preview mode (isEditRoute === false)
 *   4. Draft chip shows "Unsaved changes" when isEditRoute === true AND draftTitle !== consultantTitle
 *   5. Draft chip shows "Synced" when isEditRoute === true AND all drafts equal current values
 *   6. Stale chip appears when activeBranchType === "translation" AND activeBranch.isStale
 *   7. Revision chip appears when activeBranchType === "revision" AND sourceBranch is set
 *   8. No stale/revision chip on a clean main branch
 *   9. Variant chip "Add variant" action: clicking overflow calls onAddVariant
 *  10. Variant chip selecting another option calls navigate to that branch
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../../../test-utils/render";
import enCommon from "../../../../locales/en/common.json";
import { ResumeContextStrip } from "../ResumeContextStrip";
import type { ResumeContextStripProps } from "../ResumeContextStrip";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
    useParams: () => ({ id: "resume-test-id" }),
  };
});

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listResumeBranches: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";
const mockListResumeBranches = orpc.listResumeBranches as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const RESUME_ID = "resume-test-id";

const MAIN_BRANCH = {
  id: "branch-main",
  resumeId: RESUME_ID,
  name: "Main CV",
  isMain: true,
  branchType: "variant" as const,
  language: "en",
  headCommitId: "commit-1",
  forkedFromCommitId: null,
  sourceBranchId: null,
  sourceCommitId: null,
  isArchived: false,
  isStale: false,
  createdBy: null,
  createdAt: "2024-01-01T00:00:00Z",
};

const VARIANT_BRANCH = {
  id: "branch-variant-1",
  resumeId: RESUME_ID,
  name: "Tech Focus",
  isMain: false,
  branchType: "variant" as const,
  language: "en",
  headCommitId: "commit-v1",
  forkedFromCommitId: "commit-1",
  sourceBranchId: null,
  sourceCommitId: null,
  isArchived: false,
  isStale: false,
  createdBy: null,
  createdAt: "2024-02-01T00:00:00Z",
};

const TRANSLATION_BRANCH = {
  id: "branch-sv",
  resumeId: RESUME_ID,
  name: "Swedish",
  isMain: false,
  branchType: "translation" as const,
  language: "sv",
  headCommitId: "commit-sv",
  forkedFromCommitId: "commit-1",
  sourceBranchId: MAIN_BRANCH.id,
  sourceCommitId: null,
  isArchived: false,
  isStale: false,
  createdBy: null,
  createdAt: "2024-03-01T00:00:00Z",
};

const STALE_TRANSLATION_BRANCH = {
  ...TRANSLATION_BRANCH,
  isStale: true,
};

const REVISION_BRANCH = {
  id: "branch-revision-1",
  resumeId: RESUME_ID,
  name: "Q1 Revision",
  isMain: false,
  branchType: "revision" as const,
  language: "en",
  headCommitId: "commit-r1",
  forkedFromCommitId: "commit-1",
  sourceBranchId: MAIN_BRANCH.id,
  sourceCommitId: null,
  isArchived: false,
  isStale: false,
  createdBy: null,
  createdAt: "2024-04-01T00:00:00Z",
};

function makeBundle(overrides: Partial<ResumeContextStripProps["bundle"]> = {}): ResumeContextStripProps["bundle"] {
  return {
    id: RESUME_ID,
    isEditRoute: false,
    branches: [MAIN_BRANCH],
    activeBranchId: MAIN_BRANCH.id,
    activeBranch: MAIN_BRANCH,
    activeBranchType: "variant",
    activeBranchName: MAIN_BRANCH.name,
    variantBranchId: MAIN_BRANCH.id,
    sourceBranch: null,
    mergedCommitIds: new Set<string>(),
    language: "en",
    // Draft state — default to "synced" (draft equals current)
    draftTitle: "Jane Doe",
    consultantTitle: "Jane Doe",
    draftPresentation: "Some text",
    presentationText: "Some text",
    draftSummary: "Summary",
    summary: "Summary",
    draftHighlightedItems: "item1",
    highlightedItemsText: "item1",
    navigate: mockNavigate,
    ...overrides,
  };
}

function renderStrip(props: Partial<ResumeContextStripProps> = {}) {
  const onAddVariant = props.onAddVariant ?? vi.fn();
  const bundle = props.bundle ?? makeBundle();
  return renderWithProviders(
    <ResumeContextStrip bundle={bundle} onAddVariant={onAddVariant} />,
  );
}

beforeEach(() => {
  mockListResumeBranches.mockResolvedValue([MAIN_BRANCH, VARIANT_BRANCH]);
  mockNavigate.mockReset();
});

// ---------------------------------------------------------------------------
// 1. Variant chip renders branch name
// ---------------------------------------------------------------------------

describe("VariantChip", () => {
  it("renders the active variant branch name", () => {
    renderStrip({
      bundle: makeBundle({
        branches: [MAIN_BRANCH, VARIANT_BRANCH],
        activeBranchId: VARIANT_BRANCH.id,
        activeBranch: VARIANT_BRANCH,
        variantBranchId: VARIANT_BRANCH.id,
        activeBranchName: VARIANT_BRANCH.name,
      }),
    });
    expect(screen.getByRole("button", { name: /Tech Focus/i })).toBeInTheDocument();
  });

  it("renders the main branch name as variant label when on main branch", () => {
    renderStrip({ bundle: makeBundle() });
    expect(screen.getByRole("button", { name: /Main CV/i })).toBeInTheDocument();
  });

  // 9. Add variant action
  it("calls onAddVariant when the Add variant action is clicked", async () => {
    const user = userEvent.setup();
    const onAddVariant = vi.fn();
    renderStrip({
      bundle: makeBundle({
        branches: [MAIN_BRANCH, VARIANT_BRANCH],
        activeBranchId: MAIN_BRANCH.id,
        variantBranchId: MAIN_BRANCH.id,
      }),
      onAddVariant,
    });

    // Open the variant dropdown
    await user.click(screen.getByRole("button", { name: /Main CV/i }));
    // Click the "New variant…" action
    const addAction = await screen.findByRole("menuitem", {
      name: enCommon.resume.variants.addVariant,
    });
    await user.click(addAction);
    expect(onAddVariant).toHaveBeenCalledOnce();
  });

  // 10. Selecting another option navigates
  it("navigates to the selected branch when another variant is chosen", async () => {
    const user = userEvent.setup();
    renderStrip({
      bundle: makeBundle({
        branches: [MAIN_BRANCH, VARIANT_BRANCH],
        activeBranchId: MAIN_BRANCH.id,
        variantBranchId: MAIN_BRANCH.id,
        activeBranchName: MAIN_BRANCH.name,
      }),
    });

    await user.click(screen.getByRole("button", { name: /Main CV/i }));
    const option = await screen.findByRole("menuitem", { name: VARIANT_BRANCH.name });
    await user.click(option);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/resumes/$id/branch/$branchId",
      params: { id: RESUME_ID, branchId: VARIANT_BRANCH.id },
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Language chip renders current language label
// ---------------------------------------------------------------------------

describe("LanguageChip", () => {
  it("renders the active branch language", () => {
    renderStrip({ bundle: makeBundle({ language: "en" }) });
    expect(screen.getByRole("button", { name: /en/i })).toBeInTheDocument();
  });

  it("renders sv language when on a Swedish branch", () => {
    renderStrip({
      bundle: makeBundle({
        activeBranch: STALE_TRANSLATION_BRANCH,
        activeBranchType: "translation",
        language: "sv",
      }),
    });
    expect(screen.getByRole("button", { name: /sv/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3–5. Draft status chip
// ---------------------------------------------------------------------------

describe("DraftStatusChip", () => {
  it("shows Synced when isEditRoute is false", () => {
    renderStrip({ bundle: makeBundle({ isEditRoute: false }) });
    expect(screen.getByText(enCommon.resume.contextStrip.draftSynced)).toBeInTheDocument();
  });

  it("shows Unsaved changes when isEditRoute is true and draftTitle differs from consultantTitle", () => {
    renderStrip({
      bundle: makeBundle({
        isEditRoute: true,
        draftTitle: "Modified Title",
        consultantTitle: "Original Title",
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.draftUnsaved)).toBeInTheDocument();
  });

  it("shows Synced when isEditRoute is true and all drafts match current values", () => {
    renderStrip({
      bundle: makeBundle({
        isEditRoute: true,
        draftTitle: "Same",
        consultantTitle: "Same",
        draftPresentation: "Intro",
        presentationText: "Intro",
        draftSummary: "Sum",
        summary: "Sum",
        draftHighlightedItems: "h1",
        highlightedItemsText: "h1",
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.draftSynced)).toBeInTheDocument();
  });

  it("shows Unsaved changes when draftPresentation differs", () => {
    renderStrip({
      bundle: makeBundle({
        isEditRoute: true,
        draftPresentation: "Changed intro",
        presentationText: "Original intro",
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.draftUnsaved)).toBeInTheDocument();
  });

  it("shows Unsaved changes when draftSummary differs", () => {
    renderStrip({
      bundle: makeBundle({
        isEditRoute: true,
        draftSummary: "New summary",
        summary: "Old summary",
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.draftUnsaved)).toBeInTheDocument();
  });

  it("shows Unsaved changes when draftHighlightedItems differs", () => {
    renderStrip({
      bundle: makeBundle({
        isEditRoute: true,
        draftHighlightedItems: "new item",
        highlightedItemsText: "old item",
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.draftUnsaved)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Stale chip
// ---------------------------------------------------------------------------

describe("StaleRevisionChip — stale translation", () => {
  it("shows the stale label when branch is a stale translation", () => {
    renderStrip({
      bundle: makeBundle({
        activeBranch: STALE_TRANSLATION_BRANCH,
        activeBranchType: "translation",
        activeBranchId: STALE_TRANSLATION_BRANCH.id,
      }),
    });
    expect(screen.getByText(enCommon.resume.contextStrip.stale)).toBeInTheDocument();
  });

  it("does NOT show stale label when translation is not stale", () => {
    renderStrip({
      bundle: makeBundle({
        activeBranch: TRANSLATION_BRANCH,
        activeBranchType: "translation",
        activeBranchId: TRANSLATION_BRANCH.id,
      }),
    });
    expect(screen.queryByText(enCommon.resume.contextStrip.stale)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Revision chip
// ---------------------------------------------------------------------------

describe("StaleRevisionChip — revision branch", () => {
  it("shows the revision label with source name when on a revision branch", () => {
    renderStrip({
      bundle: makeBundle({
        activeBranch: REVISION_BRANCH,
        activeBranchType: "revision",
        activeBranchId: REVISION_BRANCH.id,
        sourceBranch: MAIN_BRANCH,
      }),
    });
    // i18next interpolation: "Revision of Main CV"
    expect(screen.getByText(/Revision of Main CV/i)).toBeInTheDocument();
  });

  it("does NOT show revision chip when sourceBranch is null", () => {
    renderStrip({
      bundle: makeBundle({
        activeBranch: REVISION_BRANCH,
        activeBranchType: "revision",
        sourceBranch: null,
      }),
    });
    expect(screen.queryByText(/Revision of/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. No stale/revision chip on clean main branch
// ---------------------------------------------------------------------------

describe("StaleRevisionChip — clean main branch", () => {
  it("shows neither stale nor revision chip on a clean main branch", () => {
    renderStrip({ bundle: makeBundle() });
    expect(screen.queryByText(enCommon.resume.contextStrip.stale)).not.toBeInTheDocument();
    expect(screen.queryByText(/Revision of/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Strip layout sanity
// ---------------------------------------------------------------------------

describe("ResumeContextStrip layout", () => {
  it("renders the strip container", () => {
    const { container } = renderStrip();
    // The strip should render something
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders all chip sections together", () => {
    renderStrip({ bundle: makeBundle({ isEditRoute: false, language: "en" }) });
    // Variant chip button
    expect(screen.getByRole("button", { name: /Main CV/i })).toBeInTheDocument();
    // Language chip button
    expect(screen.getByRole("button", { name: /en/i })).toBeInTheDocument();
    // Draft status
    expect(screen.getByText(enCommon.resume.contextStrip.draftSynced)).toBeInTheDocument();
  });
});
