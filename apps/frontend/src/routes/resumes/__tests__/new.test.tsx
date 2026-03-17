import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../test-utils/render";
import { Route } from "../new";

vi.mock("../../../orpc-client", () => ({
  orpc: {
    createResume: vi.fn(),
    listResumes: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";
const mockCreateResume = orpc.createResume as ReturnType<typeof vi.fn>;

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({ employeeId: "emp-id-1" }),
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
    }),
  };
});

const NewResumePage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return { queryClient, ...renderWithProviders(<NewResumePage />, { queryClient }) };
}

afterEach(() => vi.clearAllMocks());

describe("New Resume page", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText(enCommon.resume.new.pageTitle)).toBeInTheDocument();
  });

  it("renders title and language fields", () => {
    renderPage();
    expect(screen.getByLabelText(new RegExp(enCommon.resume.new.titleLabel, "i"))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(enCommon.resume.new.languageLabel, "i"))).toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    renderPage();
    expect(screen.getByRole("button", { name: enCommon.resume.new.saveButton })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: enCommon.resume.new.cancel })).toBeInTheDocument();
  });

  it("save button is disabled when title is empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: enCommon.resume.new.saveButton })).toBeDisabled();
  });

  it("save button is enabled after typing a title", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(new RegExp(enCommon.resume.new.titleLabel, "i")), "My Resume");
    expect(screen.getByRole("button", { name: enCommon.resume.new.saveButton })).toBeEnabled();
  });
});

describe("Successful creation", () => {
  beforeEach(() => {
    mockCreateResume.mockResolvedValue({
      id: "new-resume-id",
      employeeId: "emp-id-1",
      title: "My Resume",
      summary: null,
      language: "en",
      isMain: false,
      skills: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
  });

  it("navigates to the new resume after creation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(new RegExp(enCommon.resume.new.titleLabel, "i")), "My Resume");
    await user.click(screen.getByRole("button", { name: enCommon.resume.new.saveButton }));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/resumes/$id", params: { id: "new-resume-id" } });
    });
  });
});

describe("Error state", () => {
  beforeEach(() => {
    mockCreateResume.mockRejectedValue(new Error("Server error"));
  });

  it("shows error alert after failed creation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(new RegExp(enCommon.resume.new.titleLabel, "i")), "My Resume");
    await user.click(screen.getByRole("button", { name: enCommon.resume.new.saveButton }));
    const errorMsg = await screen.findByText(enCommon.resume.new.saveError);
    expect(errorMsg).toBeInTheDocument();
  });
});
