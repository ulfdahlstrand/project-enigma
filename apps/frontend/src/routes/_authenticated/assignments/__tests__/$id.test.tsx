import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";

import enCommon from "../../../../locales/en/common.json";
import { renderWithProviders, buildTestQueryClient } from "../../../../test-utils/render";
import { Route, getAssignmentQueryKey } from "../$id";
import { LIST_ASSIGNMENTS_QUERY_KEY } from "..";

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    getAssignment: vi.fn(),
    updateAssignment: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";
const mockGetAssignment = orpc.getAssignment as ReturnType<typeof vi.fn>;
const mockUpdateAssignment = orpc.updateAssignment as ReturnType<typeof vi.fn>;

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_ASSIGNMENT.id }),
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
    }),
  };
});

const TEST_ASSIGNMENT = {
  id: "550e8400-e29b-41d4-a716-446655440031",
  employeeId: "550e8400-e29b-41d4-a716-446655440011",
  resumeId: null,
  clientName: "Acme Corp",
  role: "Senior Developer",
  description: "Built things",
  startDate: "2023-01-01",
  endDate: null,
  technologies: ["TypeScript"],
  isCurrent: false,
  keywords: null,
  createdAt: "2023-01-01T00:00:00Z",
  updatedAt: "2023-01-01T00:00:00Z",
};

const AssignmentDetailPage = Route.options.component as React.ComponentType;

function renderPage(queryClient?: QueryClient) {
  const client = queryClient ?? buildTestQueryClient();
  return { client, ...renderWithProviders(<AssignmentDetailPage />, { queryClient: client }) };
}

afterEach(() => vi.clearAllMocks());

describe("Loading state", () => {
  it("renders progressbar while loading", () => {
    mockGetAssignment.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render inputs while loading", () => {
    mockGetAssignment.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

describe("Resolved data", () => {
  beforeEach(() => mockGetAssignment.mockResolvedValue(TEST_ASSIGNMENT));

  it("renders clientName in an input", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
  });

  it("renders role in an input", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.role);
  });

  it("does not render the id as an input value", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
    expect(screen.queryByDisplayValue(TEST_ASSIGNMENT.id)).toBeNull();
  });

  it("renders save button", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
    expect(screen.getByRole("button", { name: enCommon.assignment.detail.saveButton })).toBeInTheDocument();
  });
});

describe("Success state", () => {
  beforeEach(() => {
    mockGetAssignment.mockResolvedValue(TEST_ASSIGNMENT);
    mockUpdateAssignment.mockResolvedValue(TEST_ASSIGNMENT);
  });

  it("shows success alert after save", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
    await user.click(screen.getByRole("button", { name: enCommon.assignment.detail.saveButton }));
    await screen.findByText(enCommon.assignment.detail.saveSuccess);
  });

  it("invalidates getAssignment and listAssignments query keys", async () => {
    const queryClient = buildTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    renderPage(queryClient);

    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
    await user.click(screen.getByRole("button", { name: enCommon.assignment.detail.saveButton }));
    await screen.findByText(enCommon.assignment.detail.saveSuccess);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: getAssignmentQueryKey(TEST_ASSIGNMENT.id) }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: LIST_ASSIGNMENTS_QUERY_KEY }));
  });
});

describe("Error state", () => {
  beforeEach(() => {
    mockGetAssignment.mockResolvedValue(TEST_ASSIGNMENT);
    mockUpdateAssignment.mockRejectedValue(new Error("Server error"));
  });

  it("shows error alert after failed save", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue(TEST_ASSIGNMENT.clientName);
    await user.click(screen.getByRole("button", { name: enCommon.assignment.detail.saveButton }));
    await screen.findByText(enCommon.assignment.detail.saveError);
  });
});

describe("NOT_FOUND state", () => {
  beforeEach(() => {
    mockGetAssignment.mockRejectedValue(Object.assign(new Error("Not found"), { code: "NOT_FOUND" }));
  });

  it("renders not found message", async () => {
    renderPage();
    await screen.findByText(enCommon.assignment.detail.notFound);
  });

  it("does not render inputs", async () => {
    renderPage();
    await screen.findByText(enCommon.assignment.detail.notFound);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

describe("Exports", () => {
  it("exports Route and getAssignmentQueryKey", () => {
    expect(Route).toBeDefined();
    expect(getAssignmentQueryKey("abc")).toEqual(["getAssignment", "abc"]);
  });
});
