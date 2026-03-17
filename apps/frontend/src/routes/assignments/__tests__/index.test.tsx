import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import enCommon from "../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../test-utils/render";
import { Route, LIST_ASSIGNMENTS_QUERY_KEY } from "..";

vi.mock("../../../orpc-client", () => ({
  orpc: {
    listAssignments: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";
const mockListAssignments = orpc.listAssignments as ReturnType<typeof vi.fn>;

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
    }),
  };
});

const TEST_ASSIGNMENTS = [
  {
    id: "assign-id-1",
    employeeId: "emp-id-1",
    resumeId: null,
    clientName: "Acme Corp",
    role: "Senior Developer",
    description: "Built things",
    startDate: "2023-01-01",
    endDate: null,
    technologies: ["TypeScript"],
    isCurrent: true,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    id: "assign-id-2",
    employeeId: "emp-id-1",
    resumeId: null,
    clientName: "Beta Inc",
    role: "Backend Engineer",
    description: "",
    startDate: "2021-06-01",
    endDate: "2022-12-31",
    technologies: ["Go"],
    isCurrent: false,
    createdAt: "2021-06-01T00:00:00Z",
    updatedAt: "2022-12-31T00:00:00Z",
  },
];

const AssignmentListPage = Route.options.component as React.ComponentType;

function renderPage() {
  const queryClient = buildTestQueryClient();
  return { queryClient, ...renderWithProviders(<AssignmentListPage />, { queryClient }) };
}

afterEach(() => vi.clearAllMocks());

describe("Loading state", () => {
  it("renders progressbar while loading", () => {
    mockListAssignments.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render table rows while loading", () => {
    mockListAssignments.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryByRole("row")).toBeNull();
  });
});

describe("Empty state", () => {
  beforeEach(() => mockListAssignments.mockResolvedValue([]));

  it("renders empty message", async () => {
    renderPage();
    await screen.findByText(enCommon.assignment.empty);
  });
});

describe("List rendering", () => {
  beforeEach(() => mockListAssignments.mockResolvedValue(TEST_ASSIGNMENTS));

  it("renders page title", async () => {
    renderPage();
    await screen.findByText(enCommon.assignment.pageTitle);
  });

  it("renders client name", async () => {
    renderPage();
    await screen.findByText("Acme Corp");
  });

  it("renders role", async () => {
    renderPage();
    await screen.findByText("Senior Developer");
  });

  it("renders table headers", async () => {
    renderPage();
    await screen.findByText("Acme Corp");
    expect(screen.getByText(enCommon.assignment.tableHeaderClient)).toBeInTheDocument();
    expect(screen.getByText(enCommon.assignment.tableHeaderRole)).toBeInTheDocument();
  });
});

describe("Row click navigation", () => {
  beforeEach(() => mockListAssignments.mockResolvedValue(TEST_ASSIGNMENTS));

  it("navigates to /assignments/$id when row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByText("Acme Corp");
    await user.click(row);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/assignments/$id", params: { id: "assign-id-1" } });
  });
});

describe("Error state", () => {
  beforeEach(() => {
    mockListAssignments.mockRejectedValue(new Error("Server error"));
  });

  it("renders error alert", async () => {
    renderPage();
    const errorMsg = await screen.findByText(enCommon.assignment.error);
    expect(errorMsg).toBeInTheDocument();
  });
});

describe("Exports", () => {
  it("exports LIST_ASSIGNMENTS_QUERY_KEY", () => {
    expect(LIST_ASSIGNMENTS_QUERY_KEY).toEqual(["listAssignments"]);
  });

  it("exports Route", () => {
    expect(Route).toBeDefined();
    expect(Route.options.component).toBeDefined();
  });
});
