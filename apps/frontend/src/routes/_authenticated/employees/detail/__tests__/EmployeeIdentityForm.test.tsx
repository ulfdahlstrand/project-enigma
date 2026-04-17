/**
 * Tests for EmployeeIdentityForm — compact profile card row.
 *
 * AC1 — Avatar renders with a compact size (≤ 80px)
 * AC2 — Upload and remove buttons are reachable (rendered in the form)
 * AC3 — Name and email TextFields are rendered
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render";
import enCommon from "../../../../../locales/en/common.json";

// ---------------------------------------------------------------------------
// Mock ConsultantAvatar so we can inspect the size prop
// ---------------------------------------------------------------------------

const capturedAvatarProps: { size?: number }[] = [];

vi.mock("../../../../../components/ConsultantAvatar", () => ({
  ConsultantAvatar: (props: { name: string; profileImageDataUrl: string | null; size: number; fontSize: number }) => {
    capturedAvatarProps.push({ size: props.size });
    return <div data-testid="consultant-avatar" data-size={props.size} aria-label={props.name} />;
  },
}));

import { EmployeeIdentityForm } from "../EmployeeIdentityForm";

// ---------------------------------------------------------------------------
// Minimal props
// ---------------------------------------------------------------------------

function noop() {}

function renderForm(profileImageDataUrl: string | null = null) {
  const register = vi.fn().mockReturnValue({ name: "name", ref: noop, onChange: noop, onBlur: noop });
  const handleSubmit = vi.fn().mockReturnValue(noop);

  return renderWithProviders(
    <EmployeeIdentityForm
      employeeName="Jane Doe"
      profileImageDataUrl={profileImageDataUrl}
      register={register}
      handleSubmit={handleSubmit}
      onSubmit={noop}
      onProfileImageSelected={noop}
      onProfileImageRemoved={noop}
    />
  );
}

beforeEach(() => {
  capturedAvatarProps.length = 0;
});

// ---------------------------------------------------------------------------
// AC1 — Avatar uses a compact size (≤ 80px)
// ---------------------------------------------------------------------------

describe("AC1 — Compact avatar size", () => {
  it("renders ConsultantAvatar with size ≤ 80 for compact profile card", () => {
    renderForm();
    const avatar = screen.getByTestId("consultant-avatar");
    const size = Number(avatar.getAttribute("data-size"));
    expect(size).toBeLessThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Upload and remove buttons reachable
// ---------------------------------------------------------------------------

describe("AC2 — Upload and remove buttons rendered", () => {
  it("renders the upload profile image button", () => {
    renderForm();
    expect(screen.getByText(enCommon.employee.detail.uploadProfileImageButton)).toBeInTheDocument();
  });

  it("renders the remove profile image button", () => {
    renderForm();
    expect(screen.getByText(enCommon.employee.detail.removeProfileImageButton)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC3 — Form fields rendered
// ---------------------------------------------------------------------------

describe("AC3 — Name and email fields rendered", () => {
  it("renders the name TextField", () => {
    renderForm();
    expect(screen.getByLabelText(enCommon.employee.detail.nameLabel, { exact: false })).toBeInTheDocument();
  });

  it("renders the email TextField", () => {
    renderForm();
    expect(screen.getByLabelText(enCommon.employee.detail.emailLabel, { exact: false })).toBeInTheDocument();
  });
});
