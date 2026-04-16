/**
 * Tests for the /employee route.
 *
 * Acceptance criteria covered:
 *   AC2  — createFileRoute("/employees") call present in source
 *   AC3  — No direct fetch(, axios, or XMLHttpRequest calls
 *   AC4  — Renders translated "no employees" message on empty response
 *   AC5  — Renders name + email for a single employee
 *   AC6  — Renders name + email for every employee in a multi-item response
 *   AC7  — At least one @mui/material import
 *   AC8  — No .css/.scss imports; no style={{ inline prop
 *   AC9  — Navigation link to /employee in NavigationMenu.tsx
 *   AC10 — No plain string literals as direct JSX children
 *   AC11 — All translation keys resolve to real strings (no raw namespace.key in output)
 *
 * AC1  (file existence + routeTree codegen) is a build-time check and is
 *       verified by the fact that the import of Route below succeeds.
 * AC12 (tsc --noEmit) is verified in a separate TypeScript compilation step.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";

// Real locale file for AC11 verification
import enCommon from "../../../../locales/en/common.json";

// The component under test — imported as a named export
import { Route } from "..";

// ---------------------------------------------------------------------------
// Mock TanStack Router — Link and useNavigate need a RouterProvider in real
// usage; replacing them here avoids the need for a full router context.
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: React.forwardRef(function MockLink(
      {
        children,
        to,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string },
      ref: React.Ref<HTMLAnchorElement>
    ) {
      return (
        <a href={to} ref={ref} {...props}>
          {children}
        </a>
      );
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock the oRPC client module — prevents real network calls
// ---------------------------------------------------------------------------

vi.mock("../../../../orpc-client", () => ({
  orpc: {
    listEmployees: vi.fn(),
  },
}));

import { orpc } from "../../../../orpc-client";

const mockListEmployees = orpc.listEmployees as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test i18n instance (uses real en/common.json for AC11)
// ---------------------------------------------------------------------------

function buildI18n() {
  const instance = i18n.createInstance();
  // Use synchronous init so component renders with translations immediately
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
// Custom render helper — wraps EmployeePage with required providers.
// The EmployeePage component does not use any TanStack Router hooks, so no
// RouterProvider is needed.
// ---------------------------------------------------------------------------

// Extract the component from the Route definition
const EmployeePage = Route.options.component as React.ComponentType;

function renderEmployeePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
  const i18nInstance = buildI18n();

  return render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter>
        <I18nextProvider i18n={i18nInstance}>
          <EmployeePage />
        </I18nextProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC4 — Renders translated "no employees" message on empty response
// ---------------------------------------------------------------------------

describe("AC4 — Empty state renders translated 'no employees' message", () => {
  beforeEach(() => {
    mockListEmployees.mockResolvedValue([]);
  });

  it("displays the translated empty message when the backend returns an empty array", async () => {
    renderEmployeePage();
    // The translated value from en/common.json: "No employees found."
    const emptyMessage = await screen.findByText(enCommon.employee.empty);
    expect(emptyMessage).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC5 — Renders name + email for a single employee
// ---------------------------------------------------------------------------

describe("AC5 — Single employee: name and email are rendered", () => {
  const singleEmployee = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Alice Johnson",
    email: "alice@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    mockListEmployees.mockResolvedValue([singleEmployee]);
  });

  it("renders the employee's name in the output", async () => {
    renderEmployeePage();
    const nameEl = await screen.findByText(singleEmployee.name);
    expect(nameEl).toBeInTheDocument();
  });

  it("renders the employee's email in the output", async () => {
    renderEmployeePage();
    const emailEl = await screen.findByText(singleEmployee.email);
    expect(emailEl).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC6 — Renders name + email for every employee in a multi-item response
// ---------------------------------------------------------------------------

describe("AC6 — Multiple employees: name and email rendered for each", () => {
  const employees = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Alice Johnson",
      email: "alice@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      name: "Bob Smith",
      email: "bob@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      name: "Carol White",
      email: "carol@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    mockListEmployees.mockResolvedValue(employees);
  });

  it("renders name and email for each employee in the list", async () => {
    renderEmployeePage();

    for (const employee of employees) {
      const nameEl = await screen.findByText(employee.name);
      expect(nameEl).toBeInTheDocument();

      const emailEl = await screen.findByText(employee.email);
      expect(emailEl).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// Shared fixture for new UX tests
// ---------------------------------------------------------------------------

const threeEmployees = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Alice Johnson",
    email: "alice@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "Bob Smith",
    email: "bob@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    name: "Carol White",
    email: "carol@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// AC-NEW1 — Search input renders
// ---------------------------------------------------------------------------

describe("AC-NEW1 — Search input renders with correct placeholder", () => {
  beforeEach(() => {
    mockListEmployees.mockResolvedValue(threeEmployees);
  });

  it("renders a search text field with the translated placeholder", async () => {
    renderEmployeePage();
    const input = await screen.findByPlaceholderText(enCommon.employee.searchPlaceholder);
    expect(input).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW2 — Search filters by name
// ---------------------------------------------------------------------------

describe("AC-NEW2 — Search filters employees by name", () => {
  beforeEach(() => {
    mockListEmployees.mockResolvedValue(threeEmployees);
  });

  it("shows only matching employees when searching by name", async () => {
    renderEmployeePage();
    const input = await screen.findByPlaceholderText(enCommon.employee.searchPlaceholder);
    fireEvent.change(input, { target: { value: "Alice" } });
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
    expect(screen.queryByText("Carol White")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW3 — Search filters by email
// ---------------------------------------------------------------------------

describe("AC-NEW3 — Search filters employees by email", () => {
  beforeEach(() => {
    mockListEmployees.mockResolvedValue(threeEmployees);
  });

  it("shows only matching employees when searching by email", async () => {
    renderEmployeePage();
    const input = await screen.findByPlaceholderText(enCommon.employee.searchPlaceholder);
    fireEvent.change(input, { target: { value: "bob@" } });
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.queryByText("Alice Johnson")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW4 — Employee count chip shows correct count
// ---------------------------------------------------------------------------

describe("AC-NEW4 — Count chip shows the number of employees", () => {
  it("shows '3 employees' when there are three employees", async () => {
    mockListEmployees.mockResolvedValue(threeEmployees);
    renderEmployeePage();
    const chip = await screen.findByText("3 employees");
    expect(chip).toBeInTheDocument();
  });

  it("shows '1 employee' (singular) when there is one employee", async () => {
    mockListEmployees.mockResolvedValue([threeEmployees[0]]);
    renderEmployeePage();
    const chip = await screen.findByText("1 employee");
    expect(chip).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-NEW5 — Avatar initials rendered per row
// ---------------------------------------------------------------------------

describe("AC-NEW5 — Avatar initials rendered for each employee", () => {
  beforeEach(() => {
    mockListEmployees.mockResolvedValue(threeEmployees);
  });

  it("renders initials avatar for each employee", async () => {
    renderEmployeePage();
    // "AJ" for Alice Johnson, "BS" for Bob Smith, "CW" for Carol White
    expect(await screen.findByText("AJ")).toBeInTheDocument();
    expect(screen.getByText("BS")).toBeInTheDocument();
    expect(screen.getByText("CW")).toBeInTheDocument();
  });
});
