/**
 * Tests for the /employees/:id route — Employee Detail Page.
 *
 * Acceptance criteria covered:
 *   AC1  — File existence at apps/frontend/src/routes/employees/$id.tsx
 *           (verified by the fact that the import below succeeds)
 *   AC2  — Renders name and email TextFields when getEmployee resolves
 *   AC3  — Does NOT render an input whose value equals the employee's id
 *   AC4  — Renders a "Save" button when query resolves
 *   AC5  — Renders success Alert/Snackbar after successful save
 *   AC6  — Invalidates both getEmployee and listEmployees query keys on success
 *   AC7  — Renders error Alert with error message; TextFields retain user values
 *   AC8  — Renders CircularProgress (role="progressbar") during loading; no inputs
 *   AC9  — Renders "not found" message when getEmployee returns NOT_FOUND error
 *  AC12  — Uses the custom render function from src/test-utils/render.tsx
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";

// Real locale file — used to match displayed translated text
import enCommon from "../../../locales/en/common.json";

// Custom render utility (AC12)
import {
  renderWithProviders,
  buildTestQueryClient,
} from "../../../test-utils/render";

// Import the route to extract the component under test
import { Route, getEmployeeQueryKey } from "../$id";
import { LIST_EMPLOYEES_QUERY_KEY } from "../new";

// ---------------------------------------------------------------------------
// Mock the oRPC client — prevents real network calls
// ---------------------------------------------------------------------------

vi.mock("../../../orpc-client", () => ({
  orpc: {
    getEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    listEducation: vi.fn(),
    createEducation: vi.fn(),
    deleteEducation: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";

const mockGetEmployee = orpc.getEmployee as ReturnType<typeof vi.fn>;
const mockUpdateEmployee = orpc.updateEmployee as ReturnType<typeof vi.fn>;
const mockListEducation = orpc.listEducation as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_EMPLOYEE = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  name: "Jane Doe",
  email: "jane@example.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// The component extracted from the Route definition
// ---------------------------------------------------------------------------

const EmployeeDetailPage = Route.options.component as React.ComponentType;

// ---------------------------------------------------------------------------
// Mock Route.useParams() so the component reads the test employee id
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ id: TEST_EMPLOYEE.id }),
    Link: React.forwardRef(function MockLink(
      { children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; search?: unknown },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return <a href={typeof to === "string" ? to : "#"} ref={ref} {...props}>{children}</a>;
    }),
  };
});

// ---------------------------------------------------------------------------
// Render helper — delegates to the shared render utility (AC12)
// ---------------------------------------------------------------------------

function renderPage(queryClient?: QueryClient) {
  const client = queryClient ?? buildTestQueryClient();
  return {
    client,
    ...renderWithProviders(<EmployeeDetailPage />, { queryClient: client }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC8 — Loading state: CircularProgress present, no form inputs
// ---------------------------------------------------------------------------

describe("AC8 — Loading state", () => {
  beforeEach(() => {
    mockListEducation.mockResolvedValue([]);
  });

  it("renders a progressbar element while getEmployee is loading", () => {
    // Return a promise that never resolves — keeps the component in loading state
    mockGetEmployee.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not render any input elements while loading", () => {
    mockGetEmployee.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Renders name and email TextFields when data resolves
// ---------------------------------------------------------------------------

describe("AC2 — Resolved data: name and email TextFields", () => {
  beforeEach(() => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockListEducation.mockResolvedValue([]);
  });

  it("renders a TextField whose value equals the employee name", async () => {
    renderPage();
    const nameInput = await screen.findByDisplayValue(TEST_EMPLOYEE.name);
    expect(nameInput).toBeInTheDocument();
  });

  it("renders a TextField whose value equals the employee email", async () => {
    renderPage();
    const emailInput = await screen.findByDisplayValue(TEST_EMPLOYEE.email);
    expect(emailInput).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC3 — id field is NOT rendered as an input
// ---------------------------------------------------------------------------

describe("AC3 — Employee id is NOT rendered as an input value", () => {
  beforeEach(() => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockListEducation.mockResolvedValue([]);
  });

  it("does not render an input whose displayed value equals the employee id", async () => {
    renderPage();
    // Wait for the form to appear
    await screen.findByDisplayValue(TEST_EMPLOYEE.name);
    expect(screen.queryByDisplayValue(TEST_EMPLOYEE.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC4 — "Save" button is present when data resolves
// ---------------------------------------------------------------------------

describe('AC4 — "Save" button is rendered', () => {
  beforeEach(() => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockListEducation.mockResolvedValue([]);
  });

  it("renders a button with accessible label matching the save button text", async () => {
    renderPage();
    await screen.findByDisplayValue(TEST_EMPLOYEE.name);
    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    expect(saveButton).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC5 — Success Alert after successful save
// ---------------------------------------------------------------------------

describe("AC5 — Success message after successful save", () => {
  beforeEach(() => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockUpdateEmployee.mockResolvedValue({
      ...TEST_EMPLOYEE,
      name: TEST_EMPLOYEE.name,
      email: TEST_EMPLOYEE.email,
    });
    mockListEducation.mockResolvedValue([]);
  });

  it("displays success Alert containing the translated success message", async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for form to load
    await screen.findByDisplayValue(TEST_EMPLOYEE.name);

    // Click Save
    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    await user.click(saveButton);

    // Success message should appear
    const successMsg = await screen.findByText(
      enCommon.employee.detail.saveSuccess
    );
    expect(successMsg).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC6 — Query keys are invalidated after successful save
// ---------------------------------------------------------------------------

describe("AC6 — Query keys invalidated after successful save", () => {
  it("invalidates both getEmployee and listEmployees query keys", async () => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockUpdateEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockListEducation.mockResolvedValue([]);

    const queryClient = buildTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const user = userEvent.setup();
    renderPage(queryClient);

    await screen.findByDisplayValue(TEST_EMPLOYEE.name);

    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    await user.click(saveButton);

    // Wait for mutation to complete
    await screen.findByText(enCommon.employee.detail.saveSuccess);

    // Assert getEmployee key was invalidated
    const getEmployeeKey = getEmployeeQueryKey(TEST_EMPLOYEE.id);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: getEmployeeKey })
    );

    // Assert listEmployees key was invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: LIST_EMPLOYEES_QUERY_KEY })
    );
  });
});

// ---------------------------------------------------------------------------
// AC7 — Error Alert on mutation failure; TextFields retain user-entered values
// ---------------------------------------------------------------------------

describe("AC7 — Error on save: Alert shown, inputs retain values", () => {
  beforeEach(() => {
    mockGetEmployee.mockResolvedValue(TEST_EMPLOYEE);
    mockUpdateEmployee.mockRejectedValue(new Error("Server error"));
    mockListEducation.mockResolvedValue([]);
  });

  it("displays an error Alert containing the translated error message", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_EMPLOYEE.name);

    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    await user.click(saveButton);

    const errorMsg = await screen.findByText(
      enCommon.employee.detail.saveError
    );
    expect(errorMsg).toBeInTheDocument();
  });

  it("retains the user-entered name value after a failed save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_EMPLOYEE.name);

    // Change the name field
    const nameInput = screen.getByDisplayValue(TEST_EMPLOYEE.name);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    await user.click(saveButton);

    // Wait for error
    await screen.findByText(enCommon.employee.detail.saveError);

    // Name field should still show what the user typed
    expect(screen.getByDisplayValue("Updated Name")).toBeInTheDocument();
  });

  it("retains the user-entered email value after a failed save", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue(TEST_EMPLOYEE.email);

    // Change the email field
    const emailInput = screen.getByDisplayValue(TEST_EMPLOYEE.email);
    await user.clear(emailInput);
    await user.type(emailInput, "updated@example.com");

    const saveButton = screen.getByRole("button", {
      name: enCommon.employee.detail.saveButton,
    });
    await user.click(saveButton);

    // Wait for error
    await screen.findByText(enCommon.employee.detail.saveError);

    // Email field should still show what the user typed
    expect(screen.getByDisplayValue("updated@example.com")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC9 — NOT_FOUND error renders "Person not found" message; no inputs shown
// ---------------------------------------------------------------------------

describe("AC9 — NOT_FOUND error state", () => {
  beforeEach(() => {
    const notFoundError = Object.assign(new Error("Not found"), {
      code: "NOT_FOUND",
    });
    mockGetEmployee.mockRejectedValue(notFoundError);
    mockListEducation.mockResolvedValue([]);
  });

  it('renders the "Person not found" translated message', async () => {
    renderPage();
    const notFoundMsg = await screen.findByText(
      enCommon.employee.detail.notFound
    );
    expect(notFoundMsg).toBeInTheDocument();
  });

  it("does not render any input elements when employee is not found", async () => {
    renderPage();
    await screen.findByText(enCommon.employee.detail.notFound);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC1 — Route file existence (implicit — import succeeds)
// ---------------------------------------------------------------------------

describe("AC1 — Route file exists and exports Route", () => {
  it("exports a Route object with createFileRoute('/employees/$id')", () => {
    expect(Route).toBeDefined();
    expect(Route.options.component).toBeDefined();
  });
});
