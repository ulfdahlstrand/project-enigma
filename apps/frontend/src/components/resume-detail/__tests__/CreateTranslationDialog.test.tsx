import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, buildTestQueryClient } from "../../../test-utils/render";
import { CreateTranslationDialog } from "../CreateTranslationDialog";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../../hooks/versioning", () => ({
  useCreateTranslationResume: vi.fn(),
}));

import { useCreateTranslationResume } from "../../../hooks/versioning";
const mockUseCreateTranslation = useCreateTranslationResume as ReturnType<typeof vi.fn>;

const DEFAULT_PROPS = {
  open: true,
  sourceResumeId: "resume-sv-1",
  sourceLanguage: "sv",
  sourceTitle: "Min CV",
  onClose: vi.fn(),
};

function renderDialog(props = {}) {
  return renderWithProviders(
    <CreateTranslationDialog {...DEFAULT_PROPS} {...props} />,
    { queryClient: buildTestQueryClient() }
  );
}

afterEach(() => vi.clearAllMocks());

describe("CreateTranslationDialog", () => {
  it("renders dialog with language selector and title field", () => {
    mockUseCreateTranslation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderDialog();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("excludes source language from language options", async () => {
    mockUseCreateTranslation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderDialog({ sourceLanguage: "sv" });

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);

    const options = screen.getAllByRole("option");
    const optionValues = options.map((o) => o.getAttribute("data-value"));
    expect(optionValues).not.toContain("sv");
    expect(optionValues).toContain("en");
  });

  it("calls mutateAsync and navigates on successful create", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ resumeId: "new-en-1", commitTagId: "tag-1" });
    mockUseCreateTranslation.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderDialog();

    const createButton = screen.getByRole("button", { name: /create/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        sourceResumeId: "resume-sv-1",
        targetLanguage: "en",
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/resumes/$id", params: { id: "new-en-1" } })
      );
    });
  });

  it("shows error message when mutateAsync throws", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("fail"));
    mockUseCreateTranslation.mockReturnValue({ mutateAsync, isPending: false });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("calls onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    mockUseCreateTranslation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
