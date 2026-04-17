/**
 * Tests for EmployeeEducationSection — 3-column education grid.
 *
 * AC1 — All 3 section headings rendered
 * AC2 — Education grid container has data-testid="education-grid"
 * AC3 — Add button reachable for each section
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render";
import enCommon from "../../../../../locales/en/common.json";
import { EmployeeEducationSection } from "../EmployeeEducationSection";
import type { EducationEntry } from "../EmployeeEducationSection";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop() {}

const SECTIONS = [
  { type: "degree" as const, label: enCommon.employee.detail.educationDegrees, entries: [] as EducationEntry[] },
  { type: "certification" as const, label: enCommon.employee.detail.educationCertifications, entries: [] as EducationEntry[] },
  { type: "language" as const, label: enCommon.employee.detail.educationLanguages, entries: [] as EducationEntry[] },
];

function renderSection() {
  return renderWithProviders(
    <EmployeeEducationSection
      sections={SECTIONS}
      addingToSection={null}
      newEntryValue=""
      createError={false}
      deleteError={false}
      isDeleting={false}
      isCreating={false}
      onStartAdd={noop}
      onCancelAdd={noop}
      onCommitAdd={noop}
      onEntryValueChange={noop}
      onDeleteEntry={noop}
    />
  );
}

// ---------------------------------------------------------------------------
// AC1 — All 3 section headings rendered
// ---------------------------------------------------------------------------

describe("AC1 — All 3 section headings rendered", () => {
  it("renders the Degrees section heading", () => {
    renderSection();
    expect(screen.getByText(enCommon.employee.detail.educationDegrees.toUpperCase())).toBeInTheDocument();
  });

  it("renders the Certifications section heading", () => {
    renderSection();
    expect(screen.getByText(enCommon.employee.detail.educationCertifications.toUpperCase())).toBeInTheDocument();
  });

  it("renders the Spoken Languages section heading", () => {
    renderSection();
    expect(screen.getByText(enCommon.employee.detail.educationLanguages.toUpperCase())).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC2 — 3-column grid container with data-testid
// ---------------------------------------------------------------------------

describe("AC2 — 3-column education grid container", () => {
  it("renders a container with data-testid='education-grid'", () => {
    renderSection();
    expect(screen.getByTestId("education-grid")).toBeInTheDocument();
  });

  it("renders all 3 section headings inside the education-grid container", () => {
    renderSection();
    const grid = screen.getByTestId("education-grid");
    expect(within(grid).getByText(enCommon.employee.detail.educationDegrees.toUpperCase())).toBeInTheDocument();
    expect(within(grid).getByText(enCommon.employee.detail.educationCertifications.toUpperCase())).toBeInTheDocument();
    expect(within(grid).getByText(enCommon.employee.detail.educationLanguages.toUpperCase())).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC3 — Add buttons reachable for each section
// ---------------------------------------------------------------------------

describe("AC3 — Add buttons present for each section", () => {
  it("renders 3 add buttons (one per section)", () => {
    renderSection();
    const addButtons = screen.getAllByRole("button", {
      name: enCommon.employee.detail.educationAddButton,
    });
    expect(addButtons).toHaveLength(3);
  });
});
