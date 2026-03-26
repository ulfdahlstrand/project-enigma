import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../test-utils/render";
import { Route } from "../new";

vi.mock("../../../../components/RouterButton", () => ({
  default: React.forwardRef(function MockRouterButton(
    { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown; params?: unknown },
    ref: React.Ref<HTMLAnchorElement>
  ) {
    return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
  }),
}));

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    createResume: vi.fn(),
    listResumes: vi.fn(),
    getEmployee: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";
const mockCreateResume = orpc.createResume as ReturnType<typeof vi.fn>;
const mockGetEmployee = orpc.getEmployee as ReturnType<typeof vi.fn>;

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
  return renderWithProviders(<NewResumePage />, { queryClient });
}

beforeEach(() => {
  mockGetEmployee.mockResolvedValue({ id: "emp-id-1", name: "Ulf Dahlstrand", email: "ulf@example.com" });
});

afterEach(() => vi.clearAllMocks());

describe("New Resume page", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: enCommon.resume.new.pageTitle })).toBeInTheDocument();
  });

  it("renders title and language fields", () => {
    renderPage();
    expect(screen.getByLabelText(new RegExp(enCommon.resume.new.titleLabel, "i"))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(enCommon.resume.new.languageLabel, "i"))).toBeInTheDocument();
  });

  it("renders save button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: enCommon.resume.new.saveButton })).toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// AC-NEW1 — Helper text rendered
// ---------------------------------------------------------------------------

describe("AC-NEW1 — Helper text rendered", () => {
  it("renders the helper text below the title field", () => {
    renderPage();
    expect(screen.getByText(enCommon.resume.new.helperText)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW2 — Language select with EN/SV options
// ---------------------------------------------------------------------------

describe("AC-NEW2 — Language select renders EN and SV options", () => {
  it("renders English and Swedish as selectable options", async () => {
    const user = userEvent.setup();
    renderPage();
    const select = screen.getByRole("combobox", { name: new RegExp(enCommon.resume.new.languageLabel, "i") });
    await user.click(select);
    expect(await screen.findByRole("option", { name: enCommon.resume.new.languageOptionEn })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: enCommon.resume.new.languageOptionSv })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW3 — Cancel link rendered
// ---------------------------------------------------------------------------

describe("AC-NEW3 — Cancel link rendered", () => {
  it("renders a Cancel link", () => {
    renderPage();
    expect(screen.getByRole("link", { name: enCommon.resume.new.cancel })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW4 — Employee breadcrumb shown
// ---------------------------------------------------------------------------

describe("AC-NEW4 — Employee name shown in breadcrumb", () => {
  it("shows the employee name when employeeId is present", async () => {
    renderPage();
    expect(await screen.findByText("Ulf Dahlstrand")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW5 — Save button in PageHeader actions
// ---------------------------------------------------------------------------

describe("AC-NEW5 — Save button in PageHeader actions", () => {
  it("save button is a submit button rendered outside the form body", () => {
    renderPage();
    const saveBtn = screen.getByRole("button", { name: enCommon.resume.new.saveButton });
    expect(saveBtn).toHaveAttribute("form", "new-resume-form");
  });
});
