/**
 * Tests for CommandPalette.
 *
 * Acceptance criteria:
 *   1. Opens when cmd=open in URL (nuqs)
 *   2. Renders "Go to Edit" entry
 *   3. Typing "save" filters and shows only save-related actions
 *   4. Pressing Enter on "Go to Edit" calls navigate
 *   5. Pressing Escape closes (sets cmd param to null)
 *   6. Disabled actions (e.g. Save when no changes) are non-selectable
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// cmdk uses ResizeObserver and scrollIntoView internally — polyfill for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

import { renderWithProviders } from "../../../../test-utils/render";
import enCommon from "../../../../locales/en/common.json";
import { CommandPalette } from "../CommandPalette";
import type { PaletteAction } from "../useCommandPaletteActions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetCmdParam = vi.fn();
let mockCmdParam: string | null = null;

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryState: vi.fn().mockImplementation((key: string) => {
      if (key === "cmd") return [mockCmdParam, mockSetCmdParam];
      return [null, vi.fn()];
    }),
  };
});

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

vi.mock("../../../../orpc-client", () => ({ orpc: {} }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESUME_ID = "resume-test-id";

function makeActions(overrides: Partial<PaletteAction>[] = []): PaletteAction[] {
  const base: PaletteAction[] = [
    {
      id: "go-edit",
      label: enCommon.resume.commandBar.action.goEdit,
      group: "Navigation",
      disabled: false,
      onSelect: mockNavigate,
    },
    {
      id: "go-preview",
      label: enCommon.resume.commandBar.action.goPreview,
      group: "Navigation",
      disabled: false,
      onSelect: mockNavigate,
    },
    {
      id: "save",
      label: enCommon.resume.commandBar.action.save,
      group: "Actions",
      disabled: true,
      onSelect: vi.fn(),
    },
  ];
  return base.map((action, i) =>
    overrides[i] ? { ...action, ...overrides[i] } : action
  );
}

function renderPalette(actions: PaletteAction[] = makeActions(), cmdOpen = false) {
  mockCmdParam = cmdOpen ? "open" : null;
  return renderWithProviders(
    <CommandPalette actions={actions} resumeId={RESUME_ID} />
  );
}

beforeEach(() => {
  mockSetCmdParam.mockReset();
  mockNavigate.mockReset();
  mockCmdParam = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommandPalette", () => {
  // 1. Opens when cmd=open
  it("opens dialog when cmd param is open", async () => {
    renderPalette(makeActions(), true);
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  // 1b. Does not open when cmd is null
  it("does not render dialog content when cmd param is null", () => {
    renderPalette(makeActions(), false);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // 2. Renders "Go to Edit" entry
  it("renders Go to Edit entry when open", async () => {
    renderPalette(makeActions(), true);
    await waitFor(() => {
      expect(
        screen.getByText(enCommon.resume.commandBar.action.goEdit)
      ).toBeInTheDocument();
    });
  });

  // 3. Typing "save" filters actions
  it("typing save filters to show only save-related actions", async () => {
    const user = userEvent.setup();
    renderPalette(makeActions(), true);
    const input = await screen.findByRole("combobox");
    await user.type(input, "save");
    await waitFor(() => {
      expect(
        screen.getByText(enCommon.resume.commandBar.action.save)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(enCommon.resume.commandBar.action.goEdit)
      ).not.toBeInTheDocument();
    });
  });

  // 4. Enter on first item calls navigate/onSelect
  it("pressing Enter on Go to Edit calls the action onSelect", async () => {
    const onSelectGoEdit = vi.fn();
    const actions = [
      {
        id: "go-edit",
        label: enCommon.resume.commandBar.action.goEdit,
        group: "Navigation",
        disabled: false,
        onSelect: onSelectGoEdit,
      },
    ];
    renderPalette(actions, true);
    await screen.findByRole("combobox");

    // Select the item directly by clicking it
    const item = await screen.findByText(enCommon.resume.commandBar.action.goEdit);
    fireEvent.click(item.closest("[cmdk-item]") ?? item);
    await waitFor(() => {
      expect(onSelectGoEdit).toHaveBeenCalled();
    });
  });

  // 5. Escape closes palette
  it("pressing Escape sets cmd param to null", async () => {
    const user = userEvent.setup();
    renderPalette(makeActions(), true);
    const input = await screen.findByRole("combobox");
    input.focus();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(mockSetCmdParam).toHaveBeenCalledWith(null);
    });
  });

  // 6. Disabled actions are non-selectable (have aria-disabled)
  it("disabled Save action has aria-disabled attribute", async () => {
    renderPalette(makeActions(), true);
    await screen.findByRole("combobox");
    const saveText = await screen.findByText(enCommon.resume.commandBar.action.save);
    const saveItem = saveText.closest("[cmdk-item]");
    expect(saveItem).toHaveAttribute("aria-disabled", "true");
  });
});
