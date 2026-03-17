/**
 * Tests for the /employee route.
 *
 * Acceptance criteria covered:
 *   AC2  — createFileRoute("/employee") call present in source
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
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";

// Real locale file for AC11 verification
import enCommon from "../locales/en/common.json";

// Source file content for static grep checks (AC2, AC3, AC7, AC8, AC10)
import employeeSourceRaw from "./employee.tsx?raw";
import navigationSourceRaw from "../components/layout/NavigationMenu.tsx?raw";

// The component under test — imported as a named export
import { Route } from "./employee";

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

vi.mock("../orpc-client", () => ({
  orpc: {
    listEmployees: vi.fn(),
  },
}));

import { orpc } from "../orpc-client";

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
      <I18nextProvider i18n={i18nInstance}>
        <EmployeePage />
      </I18nextProvider>
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
// AC10 — No plain string literals as direct JSX children in employee.tsx
// ---------------------------------------------------------------------------

describe("AC10 — No plain string literals as direct JSX children in employee.tsx", () => {
  it("contains no string literals directly between JSX tags (e.g. <Tag>literal</Tag>)", () => {
    // Strip single-line comment lines before scanning for JSX text content.
    // A JSX text child looks like:  >SomePlainText<
    // Valid i18n calls look like:   >{t("key")}<  or  >{variable}<
    //
    // We scan each line, skipping comment lines, looking for:
    //   - A closing '>' followed by text that contains letters
    //   - The text is NOT wrapped in { }
    //   - Followed by an opening '<'

    const lines = employeeSourceRaw.split("\n");
    const violations: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment lines
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        continue;
      }

      // Match: >...text...< where the content does NOT start with { or end with }
      // This is the signature of a hard-coded JSX text node.
      // Pattern: >\s*[A-Za-z][^{}<>]*\s*<
      const jsxTextNodePattern = />\s*([A-Za-z][^{}<>]*?)\s*</g;
      let match: RegExpExecArray | null;
      while ((match = jsxTextNodePattern.exec(line)) !== null) {
        // match[1] is the first capture group — guard against undefined
        const captured = match[1];
        if (captured === undefined) continue;
        const textContent = captured.trim();
        // Must contain at least one letter (not just punctuation / whitespace)
        if (!textContent || !/[A-Za-z]/.test(textContent)) continue;
        violations.push(
          `Potential hard-coded JSX text child: "${textContent}" — in line: "${trimmed}"`
        );
      }
    }

    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC11 — All translation keys resolve to real strings (no raw namespace.key in output)
// ---------------------------------------------------------------------------

describe("AC11 — All translation keys resolve (no raw namespace.key in rendered output)", () => {
  it("renders no raw translation key patterns when the backend returns data", async () => {
    mockListEmployees.mockResolvedValue([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Test Employee",
        email: "test@example.com",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);

    renderEmployeePage();

    // Wait for the employee name to appear (data has loaded)
    await screen.findByText("Test Employee");

    // A raw (unresolved) translation key looks like:  employee.pageTitle
    // We check the full body text for that pattern.
    const allText = document.body.textContent ?? "";

    // Pattern: two lowercase/camelCase words separated by a dot
    // e.g. "employee.empty", "nav.employees"
    const rawKeyPattern = /\b[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*\b/g;
    const matches = allText.match(rawKeyPattern) ?? [];

    // Filter out legitimate non-key patterns (e.g. domain names in test data emails)
    const knownNonKeys = new Set([
      "example.com",
      "test.com",
      "localhost.test",
    ]);
    const suspiciousKeys = matches.filter((m) => !knownNonKeys.has(m));

    expect(suspiciousKeys).toHaveLength(0);
  });

  it("renders no raw translation key patterns when the backend returns an empty list", async () => {
    mockListEmployees.mockResolvedValue([]);

    renderEmployeePage();

    // Wait for the empty state message
    await screen.findByText(enCommon.employee.empty);

    const allText = document.body.textContent ?? "";
    const rawKeyPattern = /\b[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*\b/g;
    const matches = allText.match(rawKeyPattern) ?? [];

    const knownNonKeys = new Set(["example.com", "test.com"]);
    const suspiciousKeys = matches.filter((m) => !knownNonKeys.has(m));

    expect(suspiciousKeys).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Static file checks — AC2, AC3, AC7, AC8, AC9
// ---------------------------------------------------------------------------

describe("Static checks on employee.tsx source file", () => {
  // AC2 — createFileRoute("/employee") call present (file uses double quotes)
  it('AC2 — contains createFileRoute("/employee") call', () => {
    expect(employeeSourceRaw).toContain('createFileRoute("/employee")');
  });

  // AC3 — No direct fetch, axios, or XMLHttpRequest calls
  // Note: The file comment mentions "no direct fetch/axios" but we check for
  // actual runtime usage (import or call), not comment mentions.
  it("AC3 — does not import or call fetch() at runtime", () => {
    // Strip comment lines then search for fetch(
    const codeLines = employeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\bfetch\s*\(/);
  });

  it("AC3 — does not import or use axios at runtime", () => {
    // Strip comment lines then search for axios
    const codeLines = employeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\baxios\b/);
  });

  it("AC3 — does not contain XMLHttpRequest calls", () => {
    expect(employeeSourceRaw).not.toContain("XMLHttpRequest");
  });

  // AC7 — At least one MUI component from @mui/material is imported
  it("AC7 — imports at least one component from @mui/material", () => {
    expect(employeeSourceRaw).toMatch(/@mui\/material/);
  });

  // AC8 — No .css or .scss file imports
  it("AC8 — does not import any .css files", () => {
    expect(employeeSourceRaw).not.toMatch(/import\s+.*\.css['"]/);
  });

  it("AC8 — does not import any .scss files", () => {
    expect(employeeSourceRaw).not.toMatch(/import\s+.*\.scss['"]/);
  });

  // AC8 — No inline style={{ prop (actual JSX usage, not in comments)
  it("AC8 — does not use inline style={{ in JSX (outside comments)", () => {
    const codeLines = employeeSourceRaw
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/style=\{\{/);
  });
});

describe("Static checks on NavigationMenu.tsx source file", () => {
  // AC9 — Navigation link to /employee is present
  it('AC9 — contains a route to "/employee" path', () => {
    expect(navigationSourceRaw).toContain('"/employee"');
  });

  it("AC9 — contains the word 'employee' in NavigationMenu.tsx", () => {
    expect(navigationSourceRaw).toMatch(/employee/i);
  });
});
