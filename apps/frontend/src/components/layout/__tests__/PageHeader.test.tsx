import { render, screen } from "@testing-library/react";
import Typography from "@mui/material/Typography";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
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

import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders custom breadcrumb nodes without MUI Fragment warnings", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PageHeader
        title="Resume title"
        hideTitleBreadcrumb
        breadcrumbs={[
          { label: "Employees", to: "/employees" },
          {
            key: "resume-title",
            node: (
              <Typography variant="caption" color="text.primary">
                Resume title
              </Typography>
            ),
          },
        ]}
      />
    );

    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
    expect(screen.getAllByText("Resume title")).toHaveLength(2);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("The Breadcrumbs component doesn't accept a Fragment as a child")
    );

    consoleErrorSpy.mockRestore();
  });
});
