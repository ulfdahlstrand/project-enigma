/**
 * Tests for ResumeCommandBar.
 *
 * Acceptance criteria:
 *   1. Renders the "Press ⌘K" hint
 *   2. Shows UnsavedChip when draft diverges (isEditRoute + draftTitle !== consultantTitle)
 *   3. Hides UnsavedChip when synced
 *   4. Zoom-in button calls setZoom with next step
 *   5. Zoom-out button calls setZoom with prev step
 *   6. AI toggle calls handleToggleAssistant
 *   7. Suggestions toggle calls handleToggleSuggestions
 *   8. Pressing ⌘K opens palette (nuqs param cmd=open set)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../../../test-utils/render";
import enCommon from "../../../../locales/en/common.json";
import { ResumeCommandBar } from "../ResumeCommandBar";
import type { ResumeCommandBarBundle } from "../ResumeCommandBar";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetSearchParams = vi.fn();

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryState: vi.fn().mockImplementation((key: string) => {
      if (key === "cmd") return [null, mockSetSearchParams];
      return [null, vi.fn()];
    }),
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
    useParams: () => ({ id: "resume-test-id" }),
  };
});

vi.mock("../../../../orpc-client", () => ({
  orpc: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockHandleToggleAssistant = vi.fn();
const mockHandleToggleSuggestions = vi.fn();
const mockSetZoom = vi.fn();
const mockHandleSave = vi.fn().mockResolvedValue(undefined);
const mockSetCreateVariantDialogOpen = vi.fn();
const mockOnDeleteResume = vi.fn();

function makeBundle(overrides: Partial<ResumeCommandBarBundle> = {}): ResumeCommandBarBundle {
  return {
    id: "resume-test-id",
    isEditRoute: true,
    isEditing: true,
    zoom: 1.0,
    minZoom: 0.5,
    maxZoom: 2.0,
    setZoom: mockSetZoom,
    showSuggestionsPanel: false,
    showChatPanel: false,
    handleToggleAssistant: mockHandleToggleAssistant,
    handleToggleSuggestions: mockHandleToggleSuggestions,
    inlineRevision: {
      isOpen: false,
      stage: "planning",
    } as unknown as ResumeCommandBarBundle["inlineRevision"],
    draftTitle: "Jane Doe",
    consultantTitle: "Jane Doe",
    draftPresentation: "Some intro",
    presentationText: "Some intro",
    draftSummary: "Summary",
    summary: "Summary",
    draftHighlightedItems: "item1",
    highlightedItemsText: "item1",
    handleSave: mockHandleSave,
    setCreateVariantDialogOpen: mockSetCreateVariantDialogOpen,
    onDeleteResume: mockOnDeleteResume,
    navigate: vi.fn(),
    activeBranchId: "branch-main",
    activeBranchType: "variant",
    variantBranchId: "branch-main",
    ...overrides,
  };
}

function renderBar(bundle?: Partial<ResumeCommandBarBundle>) {
  return renderWithProviders(<ResumeCommandBar bundle={makeBundle(bundle)} />);
}

beforeEach(() => {
  mockSetSearchParams.mockReset();
  mockHandleToggleAssistant.mockReset();
  mockHandleToggleSuggestions.mockReset();
  mockSetZoom.mockReset();
  mockHandleSave.mockReset().mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// 1. Renders the "Press ⌘K" hint
// ---------------------------------------------------------------------------

describe("ResumeCommandBar", () => {
  it("renders the Press ⌘K hint", () => {
    renderBar();
    expect(screen.getByText(enCommon.resume.commandBar.openPalette)).toBeInTheDocument();
  });

  // 2. Shows UnsavedChip when draft diverges
  it("shows unsaved chip when isEditRoute and draftTitle differs from consultantTitle", () => {
    renderBar({ isEditRoute: true, draftTitle: "Changed Title", consultantTitle: "Original Title" });
    expect(screen.getByText(enCommon.resume.commandBar.unsaved)).toBeInTheDocument();
  });

  // 3. Hides UnsavedChip when synced
  it("hides unsaved chip when synced", () => {
    renderBar({
      isEditRoute: true,
      draftTitle: "Same",
      consultantTitle: "Same",
      draftPresentation: "Intro",
      presentationText: "Intro",
      draftSummary: "Sum",
      summary: "Sum",
      draftHighlightedItems: "h1",
      highlightedItemsText: "h1",
    });
    expect(screen.queryByText(enCommon.resume.commandBar.unsaved)).not.toBeInTheDocument();
  });

  // 4. Zoom-in button calls setZoom with next step
  it("zoom-in button calls setZoom with zoom + 0.1", async () => {
    const user = userEvent.setup();
    renderBar({ zoom: 1.0 });
    const zoomInBtn = screen.getByRole("button", { name: enCommon.resume.detail.zoomInLabel });
    await user.click(zoomInBtn);
    expect(mockSetZoom).toHaveBeenCalledWith(expect.closeTo(1.1, 5));
  });

  // 5. Zoom-out button calls setZoom with prev step
  it("zoom-out button calls setZoom with zoom - 0.1", async () => {
    const user = userEvent.setup();
    renderBar({ zoom: 1.0 });
    const zoomOutBtn = screen.getByRole("button", { name: enCommon.resume.detail.zoomOutLabel });
    await user.click(zoomOutBtn);
    expect(mockSetZoom).toHaveBeenCalledWith(expect.closeTo(0.9, 5));
  });

  // 6. AI toggle calls handleToggleAssistant
  it("AI toggle button calls handleToggleAssistant", async () => {
    const user = userEvent.setup();
    renderBar({ isEditRoute: true });
    const aiBtn = screen.getByRole("button", { name: /assistant/i });
    await user.click(aiBtn);
    expect(mockHandleToggleAssistant).toHaveBeenCalledOnce();
  });

  // 7. Suggestions toggle calls handleToggleSuggestions
  it("suggestions toggle button calls handleToggleSuggestions", async () => {
    const user = userEvent.setup();
    renderBar({ isEditRoute: true });
    const suggestionsBtn = screen.getByRole("button", { name: /suggestion/i });
    await user.click(suggestionsBtn);
    expect(mockHandleToggleSuggestions).toHaveBeenCalledOnce();
  });

  // 8. Pressing ⌘K opens palette
  it("pressing ⌘K sets cmd=open nuqs param", () => {
    renderBar();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(mockSetSearchParams).toHaveBeenCalledWith("open");
  });
});
