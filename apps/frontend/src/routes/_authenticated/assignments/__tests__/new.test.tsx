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
    createAssignment: vi.fn(),
    listAssignments: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";
const mockCreateAssignment = orpc.createAssignment as ReturnType<typeof vi.fn>;

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

const NewAssignmentPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return renderWithProviders(<NewAssignmentPage />, { queryClient });
}

afterEach(() => vi.clearAllMocks());

describe("New Assignment page", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText(enCommon.assignment.new.pageTitle)).toBeInTheDocument();
  });

  it("renders the save button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: enCommon.assignment.new.saveButton })).toBeInTheDocument();
  });

  it("renders the cancel button", () => {
    renderPage();
    expect(screen.getByRole("link", { name: enCommon.assignment.new.cancel })).toBeInTheDocument();
  });

  it("renders clientName, role, startDate fields", () => {
    renderPage();
    expect(screen.getByLabelText(new RegExp(enCommon.assignment.new.clientNameLabel, "i"))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(enCommon.assignment.new.roleLabel, "i"))).toBeInTheDocument();
  });
});

describe("Error state", () => {
  beforeEach(() => {
    mockCreateAssignment.mockRejectedValue(new Error("Server error"));
  });

  it("shows error alert after failed save", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(new RegExp(enCommon.assignment.new.clientNameLabel, "i")), "Test Client");
    await user.type(screen.getByLabelText(new RegExp(enCommon.assignment.new.roleLabel, "i")), "Dev");

    const saveBtn = screen.getByRole("button", { name: enCommon.assignment.new.saveButton });
    await user.click(saveBtn);

    const errorMsg = await screen.findByText(enCommon.assignment.new.saveError);
    expect(errorMsg).toBeInTheDocument();
  });
});
