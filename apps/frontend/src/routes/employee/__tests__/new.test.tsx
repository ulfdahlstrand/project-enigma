/**
 * Tests for the /employee/new route — form for creating a new employee.
 *
 * Acceptance criteria covered:
 *   AC1  — "Add person" button exists on the list page (static source check)
 *   AC2  — Form contains name TextField, email TextField, and a Save button
 *   AC3  — Submitting via useMutation (oRPC client) — no direct fetch/axios
 *   AC4  — Cache invalidation: queryClient.invalidateQueries called with
 *           LIST_EMPLOYEES_QUERY_KEY on successful mutation
 *   AC5  — Navigate to /employee/:id on successful creation
 *   AC6  — Error Alert rendered on mutation failure; form retains user input
 *   AC7  — Submitting with empty name shows inline validation error (no backend call)
 *   AC8  — Submitting with empty/invalid email shows inline validation error
 *           (no backend call)
 *   AC9  — i18n keys present in common.json and used via useTranslation
 *   AC10 — Unit tests covering (a) empty name error, (b) invalid email error,
 *           (c) valid input calls createEmployee mutation
 *
 * TypeScript compilation (tsc --noEmit) is verified as a separate CI step.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";

// Real locale file — so translated strings match what the UI renders (AC9/AC11)
import enCommon from "../../../locales/en/common.json";

// Source files for static checks (AC1, AC3, AC9)
import newEmployeeSourceRaw from "../new.tsx?raw";
import employeeListSourceRaw from "../index.tsx?raw";

// Module under test
import { Route, LIST_EMPLOYEES_QUERY_KEY } from "../new";

// ---------------------------------------------------------------------------
// Mock the oRPC client — prevents real network calls
// ---------------------------------------------------------------------------

vi.mock("../../../orpc-client", () => ({
  orpc: {
    createEmployee: vi.fn(),
  },
}));

import { orpc } from "../../../orpc-client";

const mockCreateEmployee = orpc.createEmployee as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock TanStack Router hooks used by the component
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Test i18n instance (uses the real en/common.json for accurate strings)
// ---------------------------------------------------------------------------

function buildI18n() {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: ["translation", "common"],
    defaultNS: "translation",
    resources: {
      en: {
        translation: {},
        common: enCommon,
      },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

// ---------------------------------------------------------------------------
// Component under test (extracted from the Route definition)
// ---------------------------------------------------------------------------

const NewEmployeePage = Route.options.component as React.ComponentType;

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  const i18nInstance = buildI18n();

  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18nInstance}>
          <NewEmployeePage />
        </I18nextProvider>
      </QueryClientProvider>
    ),
  };
}

// ---------------------------------------------------------------------------
// Constants derived from real translation file (prevents hard-coded strings)
// ---------------------------------------------------------------------------

const labels = enCommon.employee.new;

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC7 — Submitting with empty name shows inline validation error; no backend call
// ---------------------------------------------------------------------------

describe("AC7 — Empty name shows inline validation error without calling backend", () => {
  it("displays the name validation error when name field is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    // Fill a valid email but leave name blank
    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "test@example.com");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    expect(
      await screen.findByText(labels.nameRequired)
    ).toBeInTheDocument();
  });

  it("does not call createEmployee when name is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "test@example.com");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    // Wait long enough for any async mutation to fire
    await screen.findByText(labels.nameRequired);

    expect(mockCreateEmployee).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC8 — Submitting with invalid/empty email shows inline validation error; no backend call
// ---------------------------------------------------------------------------

describe("AC8 — Invalid email shows inline validation error without calling backend", () => {
  it("displays the email validation error when email field is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    // Fill a valid name but leave email blank
    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Alice Johnson");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    expect(
      await screen.findByText(labels.emailInvalid)
    ).toBeInTheDocument();
  });

  it("displays the email validation error when email does not match e-mail format", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Alice Johnson");

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "not-an-email");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    expect(
      await screen.findByText(labels.emailInvalid)
    ).toBeInTheDocument();
  });

  it("does not call createEmployee when email is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Alice Johnson");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await screen.findByText(labels.emailInvalid);

    expect(mockCreateEmployee).not.toHaveBeenCalled();
  });

  it("does not call createEmployee when email is invalid", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Alice Johnson");

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "bad-email-format");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await screen.findByText(labels.emailInvalid);

    expect(mockCreateEmployee).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC10(c) — Submitting valid inputs calls the createEmployee mutation
// ---------------------------------------------------------------------------

describe("AC10(c) — Valid inputs trigger the createEmployee mutation", () => {
  const NEW_EMPLOYEE = {
    id: "550e8400-e29b-41d4-a716-446655440042",
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: "2024-06-01T12:00:00Z",
    updatedAt: "2024-06-01T12:00:00Z",
  };

  beforeEach(() => {
    mockCreateEmployee.mockResolvedValue(NEW_EMPLOYEE);
  });

  it("calls orpc.createEmployee with the entered name and email", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, NEW_EMPLOYEE.name);

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, NEW_EMPLOYEE.email);

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateEmployee).toHaveBeenCalledWith({
        name: NEW_EMPLOYEE.name,
        email: NEW_EMPLOYEE.email,
      });
    });
  });

  it("calls orpc.createEmployee exactly once on a single valid submission", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, NEW_EMPLOYEE.name);

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, NEW_EMPLOYEE.email);

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateEmployee).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// AC4 — Cache invalidation after successful creation
// ---------------------------------------------------------------------------

describe("AC4 — listEmployees cache is invalidated after successful creation", () => {
  const NEW_EMPLOYEE = {
    id: "550e8400-e29b-41d4-a716-446655440042",
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: "2024-06-01T12:00:00Z",
    updatedAt: "2024-06-01T12:00:00Z",
  };

  beforeEach(() => {
    mockCreateEmployee.mockResolvedValue(NEW_EMPLOYEE);
  });

  it("calls queryClient.invalidateQueries with LIST_EMPLOYEES_QUERY_KEY", async () => {
    const user = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderPage(queryClient);

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, NEW_EMPLOYEE.name);

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, NEW_EMPLOYEE.email);

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: LIST_EMPLOYEES_QUERY_KEY })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// AC5 — Navigate to /employee/:id after successful creation
// ---------------------------------------------------------------------------

describe("AC5 — Navigate to the new employee detail page after creation", () => {
  const NEW_EMPLOYEE = {
    id: "550e8400-e29b-41d4-a716-446655440042",
    name: "Carol White",
    email: "carol@example.com",
    createdAt: "2024-06-01T12:00:00Z",
    updatedAt: "2024-06-01T12:00:00Z",
  };

  beforeEach(() => {
    mockCreateEmployee.mockResolvedValue(NEW_EMPLOYEE);
  });

  it("calls navigate to /employee/$id with the new employee's id", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, NEW_EMPLOYEE.name);

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, NEW_EMPLOYEE.email);

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/employee/$id",
        params: { id: NEW_EMPLOYEE.id },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// AC6 — Error Alert on mutation failure; form retains user input
// ---------------------------------------------------------------------------

describe("AC6 — Error Alert shown on createEmployee failure; form input retained", () => {
  beforeEach(() => {
    mockCreateEmployee.mockRejectedValue(new Error("Server error"));
  });

  it("renders an error Alert containing the translated API error message", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Diana Prince");

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "diana@example.com");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    const errorAlert = await screen.findByText(labels.apiError);
    expect(errorAlert).toBeInTheDocument();
  });

  it("retains the entered name after a failed submission", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Diana Prince");

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "diana@example.com");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await screen.findByText(labels.apiError);

    expect(screen.getByDisplayValue("Diana Prince")).toBeInTheDocument();
  });

  it("retains the entered email after a failed submission", async () => {
    const user = userEvent.setup();
    renderPage();

    const nameInput = screen.getByLabelText(labels.nameLabel, {
      exact: false,
    });
    await user.type(nameInput, "Diana Prince");

    const emailInput = screen.getByLabelText(labels.emailLabel, {
      exact: false,
    });
    await user.type(emailInput, "diana@example.com");

    const saveButton = screen.getByRole("button", { name: labels.saveButton });
    await user.click(saveButton);

    await screen.findByText(labels.apiError);

    expect(
      screen.getByDisplayValue("diana@example.com")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Static source checks — AC1, AC3, AC9
// ---------------------------------------------------------------------------

describe("Static checks on new.tsx source", () => {
  // AC3 — No direct fetch/axios/XMLHttpRequest usage
  it("AC3 — does not contain direct fetch() calls", () => {
    const codeLines = newEmployeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return (
          !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        );
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\bfetch\s*\(/);
  });

  it("AC3 — does not import or use axios", () => {
    const codeLines = newEmployeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return (
          !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        );
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\baxios\b/);
  });

  it("AC3 — does not contain XMLHttpRequest usage", () => {
    expect(newEmployeeSourceRaw).not.toContain("XMLHttpRequest");
  });

  // AC9 — i18n keys used via useTranslation (no hardcoded visible strings)
  it('AC9 — imports useTranslation from react-i18next', () => {
    expect(newEmployeeSourceRaw).toContain("useTranslation");
  });

  // Query key co-location — exported LIST_EMPLOYEES_QUERY_KEY
  it("exports LIST_EMPLOYEES_QUERY_KEY constant", () => {
    expect(newEmployeeSourceRaw).toContain("export const LIST_EMPLOYEES_QUERY_KEY");
  });

  it("LIST_EMPLOYEES_QUERY_KEY is an array constant (not an inline string)", () => {
    expect(LIST_EMPLOYEES_QUERY_KEY).toEqual(["listEmployees"]);
  });

  // No .css/.scss imports; no inline style objects
  it("does not import any .css files", () => {
    expect(newEmployeeSourceRaw).not.toMatch(/import\s+.*\.css['"]/);
  });

  it("does not import any .scss files", () => {
    expect(newEmployeeSourceRaw).not.toMatch(/import\s+.*\.scss['"]/);
  });

  it("does not use inline style={{ in JSX", () => {
    const codeLines = newEmployeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return (
          !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        );
      })
      .join("\n");
    expect(codeLines).not.toMatch(/style=\{\{/);
  });

  it('contains createFileRoute("/employee/new") call', () => {
    expect(newEmployeeSourceRaw).toContain('createFileRoute("/employee/new")');
  });
});

describe("Static checks on employee list (index.tsx) source", () => {
  // AC1 — "Add person" button present on list page
  it('AC1 — employee list page references LIST_EMPLOYEES_QUERY_KEY', () => {
    expect(employeeListSourceRaw).toContain("LIST_EMPLOYEES_QUERY_KEY");
  });

  it('AC1 — employee list page references the Add person i18n key', () => {
    expect(employeeListSourceRaw).toContain("employee.addPerson");
  });

  it('AC1 — employee list page links to /employee/new', () => {
    expect(employeeListSourceRaw).toContain("/employee/new");
  });
});

// ---------------------------------------------------------------------------
// AC9 — All required i18n keys are present in en/common.json
// ---------------------------------------------------------------------------

describe("AC9 — Required i18n keys present in en/common.json", () => {
  it("has employee.addPerson key (Add person button label on list page)", () => {
    expect(enCommon.employee.addPerson).toBeDefined();
    expect(typeof enCommon.employee.addPerson).toBe("string");
    expect(enCommon.employee.addPerson.length).toBeGreaterThan(0);
  });

  it("has employee.new.nameLabel key (name field label)", () => {
    expect(enCommon.employee.new.nameLabel).toBeDefined();
    expect(typeof enCommon.employee.new.nameLabel).toBe("string");
    expect(enCommon.employee.new.nameLabel.length).toBeGreaterThan(0);
  });

  it("has employee.new.emailLabel key (email field label)", () => {
    expect(enCommon.employee.new.emailLabel).toBeDefined();
    expect(typeof enCommon.employee.new.emailLabel).toBe("string");
    expect(enCommon.employee.new.emailLabel.length).toBeGreaterThan(0);
  });

  it("has employee.new.saveButton key (Save button label)", () => {
    expect(enCommon.employee.new.saveButton).toBeDefined();
    expect(typeof enCommon.employee.new.saveButton).toBe("string");
    expect(enCommon.employee.new.saveButton.length).toBeGreaterThan(0);
  });

  it("has employee.new.nameRequired key (name validation error)", () => {
    expect(enCommon.employee.new.nameRequired).toBeDefined();
    expect(typeof enCommon.employee.new.nameRequired).toBe("string");
    expect(enCommon.employee.new.nameRequired.length).toBeGreaterThan(0);
  });

  it("has employee.new.emailInvalid key (email validation error)", () => {
    expect(enCommon.employee.new.emailInvalid).toBeDefined();
    expect(typeof enCommon.employee.new.emailInvalid).toBe("string");
    expect(enCommon.employee.new.emailInvalid.length).toBeGreaterThan(0);
  });

  it("has employee.new.apiError key (API error Alert message)", () => {
    expect(enCommon.employee.new.apiError).toBeDefined();
    expect(typeof enCommon.employee.new.apiError).toBe("string");
    expect(enCommon.employee.new.apiError.length).toBeGreaterThan(0);
  });
});
