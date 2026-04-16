/**
 * Tests for ResumeWorkbenchTabs.
 *
 * Acceptance criteria:
 *   1. Renders tablist with 5 tabs with accessible names
 *   2. Active tab when on /resumes/:id/edit → Edit tab has aria-selected="true"
 *   3. Active tab when on /resumes/:id_/compare → Compare tab selected
 *   4. Active tab when on /resumes/:id (preview) → Preview tab selected
 *   5. Each tab is a link with correct href
 *   6. Edit tab preserves branch context (branchId in URL)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithProviders } from "../../../test-utils/render";
import enCommon from "../../../locales/en/common.json";
import { ResumeWorkbenchTabs } from "../ResumeWorkbenchTabs";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPathname = vi.fn(() => "/resumes/resume-test-id");

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => ({
      location: { pathname: mockPathname() },
    }),
    Link: React.forwardRef(function MockLink(
      {
        children,
        to,
        params,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        to?: string;
        params?: Record<string, string>;
      },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      let href = String(to ?? "");
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          href = href.replace(`$${k}`, String(v));
        }
      }
      return (
        <a href={href} ref={ref} {...props}>
          {children}
        </a>
      );
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESUME_ID = "resume-test-id";

function renderTabs(resumeId = RESUME_ID, activeBranchId: string | null = null) {
  return renderWithProviders(
    <ResumeWorkbenchTabs resumeId={resumeId} activeBranchId={activeBranchId} />
  );
}

beforeEach(() => {
  mockPathname.mockReturnValue(`/resumes/${RESUME_ID}`);
});

// ---------------------------------------------------------------------------
// 1. Tab count and accessible names
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — tab count and labels", () => {
  it("renders a tablist role", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders exactly 5 tabs", () => {
    renderTabs();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("renders Edit tab with accessible name from i18n", () => {
    renderTabs();
    expect(
      screen.getByRole("tab", { name: enCommon.resume.workbenchTabs.edit })
    ).toBeInTheDocument();
  });

  it("renders Preview tab with accessible name from i18n", () => {
    renderTabs();
    expect(
      screen.getByRole("tab", { name: enCommon.resume.workbenchTabs.preview })
    ).toBeInTheDocument();
  });

  it("renders History tab with accessible name from i18n", () => {
    renderTabs();
    expect(
      screen.getByRole("tab", { name: enCommon.resume.workbenchTabs.history })
    ).toBeInTheDocument();
  });

  it("renders Compare tab with accessible name from i18n", () => {
    renderTabs();
    expect(
      screen.getByRole("tab", { name: enCommon.resume.workbenchTabs.compare })
    ).toBeInTheDocument();
  });

  it("renders Variants tab with accessible name from i18n", () => {
    renderTabs();
    expect(
      screen.getByRole("tab", { name: enCommon.resume.workbenchTabs.variants })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Active tab — Edit route
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — active tab on Edit route", () => {
  it("selects the Edit tab when on the edit route", () => {
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}/edit`);
    renderTabs();
    const editTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.edit,
    });
    expect(editTab).toHaveAttribute("aria-selected", "true");
  });

  it("does not select Preview when on the edit route", () => {
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}/edit`);
    renderTabs();
    const previewTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.preview,
    });
    expect(previewTab).toHaveAttribute("aria-selected", "false");
  });
});

// ---------------------------------------------------------------------------
// 3. Active tab — Compare route
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — active tab on Compare route", () => {
  it("selects the Compare tab when on the compare route", () => {
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}/compare`);
    renderTabs();
    const compareTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.compare,
    });
    expect(compareTab).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// 4. Active tab — Preview (default) route
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — active tab on Preview (default) route", () => {
  it("selects the Preview tab on the resume root route", () => {
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}`);
    renderTabs();
    const previewTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.preview,
    });
    expect(previewTab).toHaveAttribute("aria-selected", "true");
  });

  it("selects the Preview tab on a branch preview route", () => {
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}/branch/branch-abc`);
    renderTabs();
    const previewTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.preview,
    });
    expect(previewTab).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// 5. Each tab has an href (is a link)
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — tab links", () => {
  it("Edit tab has href pointing to the edit route", () => {
    renderTabs();
    const editTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.edit,
    });
    expect(editTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/edit`
    );
  });

  it("Preview tab has href pointing to the resume root route", () => {
    renderTabs();
    const previewTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.preview,
    });
    expect(previewTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}`
    );
  });

  it("History tab has href pointing to the history route", () => {
    renderTabs();
    const historyTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.history,
    });
    expect(historyTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/history`
    );
  });

  it("Compare tab has href pointing to the compare route", () => {
    renderTabs();
    const compareTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.compare,
    });
    expect(compareTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/compare`
    );
  });

  it("Variants tab has href pointing to the variants route", () => {
    renderTabs();
    const variantsTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.variants,
    });
    expect(variantsTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/variants`
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Edit tab preserves branch context
// ---------------------------------------------------------------------------

describe("ResumeWorkbenchTabs — Edit tab branch context", () => {
  it("points Edit tab to /edit/branch/:branchId when on a branch preview route", () => {
    const branchId = "branch-xyz";
    mockPathname.mockReturnValue(`/resumes/${RESUME_ID}/branch/${branchId}`);
    renderTabs(RESUME_ID, branchId);
    const editTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.edit,
    });
    expect(editTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/edit/branch/${branchId}`
    );
  });

  it("points Edit tab to plain /edit when activeBranchId is null", () => {
    renderTabs(RESUME_ID, null);
    const editTab = screen.getByRole("tab", {
      name: enCommon.resume.workbenchTabs.edit,
    });
    expect(editTab.closest("a")).toHaveAttribute(
      "href",
      `/resumes/${RESUME_ID}/edit`
    );
  });
});
